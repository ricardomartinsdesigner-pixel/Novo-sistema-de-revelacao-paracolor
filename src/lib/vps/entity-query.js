export function entityDataExpression(path) {
  if (path === "id") return "id";
  if (path === "created_by_id") return "created_by_id";
  if (path === "created_date") return `to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
  if (path === "updated_date") return `to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(path)) throw Object.assign(new Error("Campo de busca inválido."), { status: 400 });
  const parts = path.split(".");
  return `data #>> '{${parts.join(",")}}'`;
}

export function compileEntityQuery(query, values = []) {
  if (!query || typeof query !== "object" || Array.isArray(query)) throw Object.assign(new Error("Filtro inválido."), { status: 400 });
  const clauses = [];
  for (const [key, expected] of Object.entries(query)) {
    if (key === "$or" || key === "$and") {
      if (!Array.isArray(expected) || !expected.length || expected.length > 30) throw Object.assign(new Error("Filtro inválido."), { status: 400 });
      const parts = expected.map((part) => compileEntityQuery(part, values));
      clauses.push(`(${parts.join(key === "$or" ? " OR " : " AND ")})`);
      continue;
    }
    const expression = entityDataExpression(key);
    const comparisons = expected && typeof expected === "object" && !Array.isArray(expected)
      ? Object.entries(expected).filter(([operator]) => operator !== "$options")
      : [["$eq", expected]];
    for (const [operator, value] of comparisons) {
      if (operator === "$exists") {
        clauses.push(value ? `${expression} IS NOT NULL` : `${expression} IS NULL`);
        continue;
      }
      if (operator === "$in" || operator === "$nin") {
        if (!Array.isArray(value) || value.length > 1000) throw Object.assign(new Error("Filtro inválido."), { status: 400 });
        if (!value.length) { clauses.push(operator === "$in" ? "FALSE" : "TRUE"); continue; }
        const includesNull = value.some((entry) => entry == null);
        const nonNullValues = value.filter((entry) => entry != null);
        const slots = nonNullValues.map((entry) => { values.push(String(entry)); return `$${values.length}`; });
        if (!slots.length) clauses.push(`${expression} IS ${operator === "$in" ? "" : "NOT "}NULL`);
        else if (includesNull && operator === "$in") clauses.push(`(${expression} IS NULL OR ${expression} IN (${slots.join(",")}))`);
        else if (includesNull) clauses.push(`(${expression} IS NOT NULL AND ${expression} NOT IN (${slots.join(",")}))`);
        else clauses.push(`${expression} ${operator === "$nin" ? "NOT IN" : "IN"} (${slots.join(",")})`);
        continue;
      }
      const operators = { $eq: "=", $ne: "<>", $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" };
      const sqlOperator = operators[operator];
      if (!sqlOperator) throw Object.assign(new Error("Este tipo de filtro não é permitido."), { status: 400 });
      if (value == null) {
        clauses.push(operator === "$ne" ? `${expression} IS NOT NULL` : `${expression} IS NULL`);
        continue;
      }
      const isNumeric = typeof value === "number";
      values.push(String(value));
      const parameter = `$${values.length}`;
      const left = isNumeric ? `CASE WHEN ${expression} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${expression})::numeric END` : expression;
      clauses.push(`${left} ${sqlOperator} ${parameter}${isNumeric ? "::numeric" : ""}`);
    }
  }
  return clauses.join(" AND ") || "TRUE";
}

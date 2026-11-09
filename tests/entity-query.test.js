import test from "node:test";
import assert from "node:assert/strict";
import { compileEntityQuery } from "../src/lib/vps/entity-query.js";

test("entity filters compile safely for nested and combined fields", () => {
  const values = [];
  const sql = compileEntityQuery({
    $or: [{ status: "novo" }, { "customer.email": "cliente@example.com" }],
    active: true,
  }, values);
  assert.match(sql, /\(data #>> '\{status\}' = \$1 OR data #>> '\{customer,email\}' = \$2\)/);
  assert.match(sql, /data #>> '\{active\}' = \$3/);
  assert.deepEqual(values, ["novo", "cliente@example.com", "true"]);
});

test("entity filters preserve null checks and use numeric comparisons", () => {
  const values = [];
  const sql = compileEntityQuery({
    original_file_uri: { $nin: [null, ""] },
    count: { $gte: 12 },
  }, values);
  assert.match(sql, /IS NOT NULL AND data #>> '\{original_file_uri\}' NOT IN \(\$1\)/);
  assert.match(sql, /END >= \$2::numeric/);
  assert.deepEqual(values, ["", "12"]);
});

test("unsupported regular-expression filters are rejected", () => {
  assert.throws(() => compileEntityQuery({ name: { $regex: ".*" } }, []), /não é permitido/);
});

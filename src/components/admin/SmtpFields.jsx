const inputClass = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";

export default function SmtpFields({ form, setForm, disabled }) {
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const fields = [
    { key: "host", label: "Servidor SMTP", placeholder: "Servidor de saída do seu provedor", max: 253 },
    { key: "username", label: "Usuário SMTP", placeholder: "Usuário informado pelo provedor", max: 320 },
    { key: "password", label: "Senha SMTP", type: "password", placeholder: form.has_password ? "Senha salva — deixe vazio para manter" : "Senha ou senha de aplicativo", max: 1024 },
    { key: "from_email", label: "E-mail do remetente", type: "email", placeholder: "E-mail autorizado pelo provedor", max: 254 },
  ];
  return (
    <fieldset disabled={disabled} className="mt-4 grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <label key={field.key} className="text-xs text-muted-foreground">
          {field.label}
          <input type={field.type || "text"} value={form[field.key]} autoComplete={field.key === "password" ? "new-password" : "off"} required={field.key !== "password" || !form.has_password} maxLength={field.max} placeholder={field.placeholder} onChange={(event) => change(field.key, event.target.value)} className={inputClass} />
        </label>
      ))}
      <label className="text-xs text-muted-foreground">
        Porta
        <select value={form.port} onChange={(event) => { const port = Number(event.target.value); setForm((current) => ({ ...current, port, security: port === 465 ? "tls" : "starttls" })); }} className={inputClass}>
          <option value={465}>465</option><option value={587}>587</option><option value={2525}>2525</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Segurança
        <select value={form.security} onChange={(event) => change("security", event.target.value)} className={inputClass}>
          <option value="tls">SSL/TLS — conexão segura desde o início</option>
          <option value="starttls">STARTTLS — conexão com TLS obrigatório</option>
        </select>
      </label>
    </fieldset>
  );
}
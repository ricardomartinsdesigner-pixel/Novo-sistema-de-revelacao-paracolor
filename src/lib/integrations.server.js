function asArray(result) {
  if (Array.isArray(result)) return result;
  return result?.items ?? [];
}

export async function loadIntegrationConfig(base44) {
  const rows = asArray(
    await base44.asServiceRole.entities.IntegrationConfig.list({ sort: "-created_date", limit: 1 })
  );
  return rows[0] ?? null;
}

export async function getMercadoPagoToken(base44) {
  const config = await loadIntegrationConfig(base44).catch(() => null);
  const enabled = config ? config.mp_enabled === true : true;
  const stored = (config?.mp_access_token ?? "").trim();
  const token = stored || (process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "").trim();
  return enabled ? token : "";
}

export async function getMercadoPagoWebhookSecret(base44) {
  const config = await loadIntegrationConfig(base44).catch(() => null);
  return (config?.mp_webhook_secret ?? process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "").trim();
}

export async function getMelhorEnvioConfig(base44) {
  const config = await loadIntegrationConfig(base44).catch(() => null);
  const token = (config?.me_token ?? "").trim() || (process.env.MELHOR_ENVIO_TOKEN ?? "").trim();
  return {
    enabled: config ? config.me_enabled === true : Boolean(token),
    sandbox: config ? config.me_sandbox !== false : true,
    from_cep: (config?.me_from_cep ?? "").trim(),
    contact_email: (config?.me_contact_email ?? process.env.MELHOR_ENVIO_CONTACT_EMAIL ?? "").trim(),
    package_width: Number(config?.me_package_width ?? process.env.MELHOR_ENVIO_PACKAGE_WIDTH ?? 22),
    package_height: Number(config?.me_package_height ?? process.env.MELHOR_ENVIO_PACKAGE_HEIGHT ?? 6),
    package_length: Number(config?.me_package_length ?? process.env.MELHOR_ENVIO_PACKAGE_LENGTH ?? 30),
    package_weight: Number(config?.me_package_weight ?? process.env.MELHOR_ENVIO_PACKAGE_WEIGHT ?? 0.4),
    token,
  };
}

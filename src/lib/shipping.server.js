import { getMelhorEnvioConfig } from "@/lib/integrations.server";

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

function asOption(service) {
  if (!service || service.error) return null;
  const price = Number(service.custom_price ?? service.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    id: String(service.id),
    name: service.name || "Envio",
    company: service.company?.name || "",
    price: Math.round(price * 100) / 100,
    days: Number(service.custom_delivery_time ?? service.delivery_time) || null,
  };
}

export async function quoteMelhorEnvio(base44, { to_cep, insurance }) {
  const config = await getMelhorEnvioConfig(base44);
  if (!config.enabled || !config.token || onlyDigits(config.from_cep).length !== 8 || !config.contact_email) return null;
  if (onlyDigits(to_cep).length !== 8) return null;

  const base = config.sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
  try {
    const response = await fetch(`${base}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": `Paracolor (${config.contact_email})`,
      },
      body: JSON.stringify({
        from: { postal_code: onlyDigits(config.from_cep) },
        to: { postal_code: onlyDigits(to_cep) },
        products: [
          { id: "1", width: config.package_width, height: config.package_height, length: config.package_length, weight: config.package_weight, insurance_value: Number(insurance) || 0, quantity: 1 },
        ],
        options: { receipt: false, own_hand: false, collect: false },
      }),
    });
    if (!response.ok) return null;
    const services = await response.json();
    if (!Array.isArray(services)) return null;
    return services.map(asOption).filter(Boolean).sort((a, b) => a.price - b.price);
  } catch {
    return null;
  }
}

export async function pickShippingOption(base44, { to_cep, service_id, insurance }) {
  const options = await quoteMelhorEnvio(base44, { to_cep, insurance });
  if (!options?.length) return null;
  return options.find((option) => option.id === String(service_id)) ?? null;
}

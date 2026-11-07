export const AREAS = [
  {
    key: "revelacao",
    label: "Revelação",
    path: "/revelacao",
    tagline: "Fotos clássicas e quadradas, com ou sem borda, em papel fotográfico de verdade.",
    image: "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/9057474b8_generated_c016e18b.png",
    cta: "Revelar fotos",
  },
  {
    key: "polaroids",
    label: "Polaroids",
    path: "/polaroids",
    tagline: "Aquele formato instantâneo com moldura branca e legenda escrita à mão.",
    image: "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/5d00b9c29_generated_10711ebd.png",
    cta: "Criar polaroids",
  },
  {
    key: "banners",
    label: "Banners",
    path: "/banners",
    tagline: "Lonas, faixas e banners promocionais no tamanho que você precisa.",
    image: "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/1d8a2815a_generated_1ad407e5.png",
    cta: "Fazer orçamento",
  },
  {
    key: "personalizados",
    label: "Personalizados",
    path: "/personalizados",
    tagline: "Canecas, almofadas e porta-retratos com as suas fotos.",
    image: "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/6826100ce_generated_00c45475.png",
    cta: "Ver produtos",
  },
  {
    key: "molduras",
    label: "Molduras",
    path: "/molduras",
    tagline: "Molduras para dar acabamento e presença às suas fotos favoritas.",
    image: "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/316be45c4_generated_93d09dca.png",
    cta: "Ver vitrine",
  },
];

export const HERO_IMAGE = "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/52dc2aa3d_generated_a9f3a6ca.png";

export function areaByKey(key) {
  return AREAS.find((area) => area.key === key);
}

export const STATUS_LABELS = {
  aguardando_pagamento: "Aguardando pagamento",
  pagamento_aprovado: "Pagamento aprovado",
  aguardando_arte: "Aguardando criação da arte",
  aguardando_aprovacao: "Aguardando aprovação do cliente",
  ajustes_solicitados: "Ajustes solicitados",
  arte_aprovada: "Arte aprovada",
  aguardando_producao: "Aguardando produção",
  em_producao: "Em produção",
  aguardando_conferencia: "Aguardando conferência",
  pronto: "Pronto para retirada/envio",
  enviado: "Enviado",
  concluido: "Entregue",
  cancelado: "Cancelado",
};

export const STATUS_FLOW = [
  "aguardando_pagamento",
  "pagamento_aprovado",
  "aguardando_arte",
  "aguardando_aprovacao",
  "ajustes_solicitados",
  "arte_aprovada",
  "aguardando_producao",
  "em_producao",
  "aguardando_conferencia",
  "pronto",
  "enviado",
  "concluido",
  "cancelado",
];

export function formatBRL(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
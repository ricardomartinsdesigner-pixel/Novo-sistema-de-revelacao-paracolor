export const AREAS = [
  {
    key: "revelacao",
    label: "Revelação",
    path: "/revelacao",
    tagline: "Fotos clássicas e quadradas, com ou sem borda, em papel fotográfico de verdade.",
    image: "/loja/revelacao.webp",
    cta: "Revelar fotos",
  },
  {
    key: "polaroids",
    label: "Polaroides",
    path: "/polaroids",
    tagline: "Aquele formato instantâneo com moldura branca e legenda escrita à mão.",
    image: "/loja/polaroids.webp",
    cta: "Criar polaroids",
  },
  {
    key: "fotos_ima",
    label: "Fotos Ímã",
    path: "/fotos-ima",
    tagline: "Tirinhas e fotos magnéticas personalizadas com as suas imagens.",
    image: "/loja/personalizados.webp",
    cta: "Criar fotos ímã",
  },
  {
    key: "banners",
    label: "Banners",
    path: "/banners",
    tagline: "Lonas, faixas e banners promocionais no tamanho que você precisa.",
    image: "/loja/banners.webp",
    cta: "Fazer orçamento",
  },
  {
    key: "personalizados",
    label: "Personalizados",
    path: "/personalizados",
    tagline: "Canecas, almofadas e porta-retratos com as suas fotos.",
    image: "/loja/personalizados.webp",
    cta: "Ver produtos",
  },
  {
    key: "molduras",
    label: "Molduras",
    path: "/molduras",
    tagline: "Molduras para dar acabamento e presença às suas fotos favoritas.",
    image: "/loja/molduras.webp",
    cta: "Ver vitrine",
  },
  {
    key: "albuns_books",
    label: "Álbuns e Books",
    path: "/albuns-e-books",
    tagline: "Álbuns e books para guardar histórias, com opções de capa personalizada.",
    image: "/loja/personalizados.webp",
    cta: "Ver álbuns e books",
  },
];

export const HERO_IMAGE = "/loja/inicio.webp";
export const STUDIO_COVER_FALLBACK = "/loja/estudio.webp";

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
  retirado: "Retirado",
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
  "retirado",
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

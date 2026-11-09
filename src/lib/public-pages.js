import { AREAS } from "./areas";

export const PAGE_GROUPS = [
  {
    label: "Vitrine e apresentação",
    pages: [
      { setting: "page_home", label: "Página inicial" },
      ...AREAS.map((area) => ({ setting: `module_${area.key}`, label: area.label })),
      { setting: "module_servicos", label: "Serviços" },
      { setting: "module_estudio", label: "Estúdio Fotográfico" },
    ],
  },
  {
    label: "Compra e atendimento",
    pages: [
      { setting: "page_revelar", label: "Editor para revelar fotos" },
      { setting: "page_polaroids_criar", label: "Editor de Polaroids" },
      { setting: "page_banner_pedido", label: "Configuração de pedido de banner" },
      { setting: "page_personalizado_produto", label: "Detalhe de produto personalizado" },
      { setting: "page_album_book_produto", label: "Detalhe de álbum ou book" },
      { setting: "page_carrinho", label: "Carrinho" },
      { setting: "page_checkout", label: "Finalização do pedido" },
      { setting: "page_minha_conta", label: "Minha conta e meus pedidos" },
      { setting: "page_pedido", label: "Detalhes e acompanhamento do pedido" },
      { setting: "page_consultar_pedido", label: "Consulta de pedido" },
      { setting: "page_simulador", label: "Calculadora de preços por quantidade" },
    ],
  },
  {
    label: "Contato e institucional",
    pages: [
      { setting: "page_contato", label: "Contato" },
      { setting: "page_privacidade", label: "Política de privacidade" },
      { setting: "page_termos", label: "Termos de uso" },
      { setting: "page_trocas", label: "Entrega, troca e cancelamento" },
    ],
  },
];

export const FEATURE_MODULES = [
  { key: "module_molduras_online", label: "Venda online de molduras" },
  { key: "module_aprovacao_whatsapp", label: "Aprovação de arte por WhatsApp" },
  { key: "module_destaques", label: "Destaques na home" },
  { key: "module_promocoes", label: "Promoções" },
  { key: "module_destaque_estudio", label: "Atalho do Estúdio na página inicial" },
  { key: "module_estacionamento", label: "Destaque de estacionamento próprio" },
  { key: "module_photo_duplicate_organizer", label: "Organizador de fotos repetidas" },
  { key: "module_polaroid_batch_mounter", label: "Montador de Polaroides em lote para o público" },
];

const normalizePath = (value = "") => value.replace(/\/+$/, "") || "/";

export function publicPageSettings(pathname = "") {
  const path = normalizePath(pathname);
  if (path === "/") return ["page_home"];

  const settings = [];
  const area = AREAS.find((item) => path === item.path || path.startsWith(`${item.path}/`));
  if (area) settings.push(`module_${area.key}`);
  if (path === "/servicos" || path.startsWith("/servicos/")) settings.push("module_servicos");
  if (path === "/estudio-fotografico" || path.startsWith("/estudio-fotografico/")) settings.push("module_estudio");

  const exactOrNested = (base, key) => path === base || path.startsWith(`${base}/`) ? settings.push(key) : null;
  const nestedOnly = (base, key) => path.startsWith(`${base}/`) ? settings.push(key) : null;
  exactOrNested("/revelar", "page_revelar");
  exactOrNested("/polaroids/criar", "page_polaroids_criar");
  exactOrNested("/banners/pedido", "page_banner_pedido");
  nestedOnly("/personalizados", "page_personalizado_produto");
  nestedOnly("/albuns-e-books", "page_album_book_produto");
  exactOrNested("/carrinho", "page_carrinho");
  exactOrNested("/checkout", "page_checkout");
  exactOrNested("/minha-conta", "page_minha_conta");
  exactOrNested("/pedido", "page_pedido");
  exactOrNested("/consultar-pedido", "page_consultar_pedido");
  exactOrNested("/simulador", "page_simulador");
  exactOrNested("/montador-polaroides", "module_polaroid_batch_mounter");
  exactOrNested("/contato", "page_contato");
  exactOrNested("/privacidade", "page_privacidade");
  exactOrNested("/termos", "page_termos");
  exactOrNested("/trocas", "page_trocas");
  return [...new Set(settings)];
}

export function publicPageEnabled(settings, setting) {
  return !settings || settings[setting] !== false;
}

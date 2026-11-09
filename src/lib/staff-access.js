export const STAFF_ROLES = ["atendimento", "producao", "gerencia", "admin"];

const roleAccess = {
  atendimento: new Set(["orders", "clients", "art"]),
  producao: new Set(["orders", "production", "art"]),
  gerencia: new Set(["orders", "clients", "production", "deliveries", "payments", "reports", "art"]),
  admin: new Set(["*"]),
};

export function hasStaffAccess(user, permission) {
  const access = roleAccess[user?.role];
  return Boolean(access && (access.has("*") || access.has(permission)));
}

export function roleLabel(role) {
  return ({ atendimento: "Atendimento", producao: "Produção", gerencia: "Gerência", admin: "Administrador" })[role] || "Sem acesso";
}

export function adminPathPermission(pathname = "") {
  if (pathname === "/admin") return "overview";
  if (pathname.startsWith("/admin/pedidos")) return "orders";
  if (pathname.startsWith("/admin/clientes")) return "clients";
  if (pathname.startsWith("/admin/producao")) return "production";
  if (pathname.startsWith("/admin/entregas")) return "deliveries";
  if (pathname.startsWith("/admin/pagamentos")) return "payments";
  if (pathname.startsWith("/admin/relatorios")) return "reports";
  if (pathname.startsWith("/admin/retirada")) return "orders";
  return "admin";
}

export function canUpdateOrderAsStaff(user, status) {
  if (user?.role === "admin" || user?.role === "gerencia") return true;
  if (user?.role === "producao") return ["aguardando_producao", "em_producao", "aguardando_conferencia", "pronto"].includes(status);
  if (user?.role === "atendimento") return ["aguardando_arte", "aguardando_aprovacao", "ajustes_solicitados", "arte_aprovada", "enviado", "retirado", "concluido"].includes(status);
  return false;
}

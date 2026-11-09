import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { getPool, withTransaction } from "@/lib/vps/db.server";
import { makeEntityService } from "@/lib/vps/entities.server";
import { STAFF_ROLES } from "@/lib/staff-access";

function requireAdmin(user) {
  if (user?.role !== "admin") throw new Error("Apenas administradores podem gerenciar a equipe.");
}

async function findAccount(db, email, userId = "", lock = false) {
  const { rows: [user] } = await db.query(
    `SELECT id, data->>'role' AS role, data->'is_verified' = 'true'::jsonb AS verified
     FROM vps_records WHERE entity='User' AND ${userId ? "id=$1" : "lower(data->>'email')=$1"}
     ${lock ? "FOR UPDATE" : ""}`,
    [userId || email.trim().toLowerCase()],
  );
  return user;
}

async function lockEmployee(db, id) {
  const { rowCount } = await db.query("SELECT 1 FROM vps_records WHERE entity='Employee' AND id=$1 FOR UPDATE", [id]);
  if (!rowCount) throw new Error("Funcionário não encontrado.");
}

async function setAccountRole(entities, user, role) {
  if (!user) throw new Error("A conta vinculada não foi encontrada. Confira o cadastro do funcionário.");
  if (user.role === role) return;
  const updated = await entities.User.update(user.id, { role });
  if (updated.role !== role) throw new Error("Não foi possível confirmar a alteração de acesso.");
}

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    requireAdmin(context.user);
    const result = await context.getBase44().asServiceRole.entities.Employee.list({
      sort: "name",
      limit: 200,
    });
    return result.items ?? [];
  });

const EmployeeInput = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional(),
  job_title: z.string().max(60).optional(),
  access_role: z.enum(STAFF_ROLES).default("atendimento"),
});

export const getEmployeeAccountState = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ email: z.string().email().max(160) }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const role = context.getBase44().asServiceRole;
    const email = data.email.trim().toLowerCase();
    const existing = await role.entities.Employee.filter({ email }, { limit: 1 });
    if (existing.items?.length) throw new Error("Este e-mail já está cadastrado na equipe.");
    return { exists: Boolean(await findAccount(getPool(), email)) };
  });

// Vincula a conta criada pelo fluxo de cadastro da plataforma, sem enviar convite.
export const registerEmployee = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(EmployeeInput)
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const email = data.email.trim().toLowerCase();
    return withTransaction(async (db) => {
      const { entities } = makeEntityService(context.user, true, db);
      const user = await findAccount(db, email, "", true);
      if (!user?.verified) throw new Error("Conclua a criação da conta e a confirmação do e-mail antes de liberar o acesso.");
      const existing = await entities.Employee.filter({ $or: [{ user_id: user.id }, { email }] }, { limit: 1 });
      if (existing.items?.length) throw new Error("Esta conta já está cadastrada na equipe.");
      await setAccountRole(entities, user, data.access_role);
      const employee = await entities.Employee.create({
        name: data.name.trim(), email, phone: data.phone ?? "",
        job_title: data.job_title?.trim() || "Funcionário", access_role: data.access_role, user_id: user.id, active: true,
      });
      return { employee, has_access: true };
    });
  });

// A senha é sempre criada pelo próprio funcionário: aqui só reenviamos o convite.
export const resendEmployeeInvite = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const employee = await context.getBase44().asServiceRole.entities.Employee.get(data.id);
      await context.getBase44().users.inviteUser(employee.email, employee.access_role || "atendimento");
    return { sent: true };
  });

export const setEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return withTransaction(async (db) => {
      await lockEmployee(db, data.id);
      const { entities } = makeEntityService(context.user, true, db);
      const employee = await entities.Employee.get(data.id);
      const user = await findAccount(db, employee.email, employee.user_id, true);
      if (!data.active && user?.id === context.user.id) throw new Error("Você não pode bloquear o seu próprio acesso.");
      if (data.active && !user?.verified) throw new Error("A conta vinculada precisa estar confirmada para liberar o acesso.");
      await setAccountRole(entities, user, data.active ? (employee.access_role || "admin") : "user");
      return entities.Employee.update(employee.id, { active: data.active, user_id: user.id });
    });
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1), access_role: z.enum(STAFF_ROLES) }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return withTransaction(async (db) => {
      await lockEmployee(db, data.id);
      const { entities } = makeEntityService(context.user, true, db);
      const employee = await entities.Employee.get(data.id);
      if (employee.user_id === context.user.id) throw new Error("Para evitar perder o acesso, altere o seu próprio nível por outra conta administradora.");
      const user = await findAccount(db, employee.email, employee.user_id, true);
      if (employee.active && user?.verified) await setAccountRole(entities, user, data.access_role);
      return entities.Employee.update(employee.id, { access_role: data.access_role });
    });
  });

export const removeEmployee = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return withTransaction(async (db) => {
      await lockEmployee(db, data.id);
      const { entities } = makeEntityService(context.user, true, db);
      const employee = await entities.Employee.get(data.id);
      const user = await findAccount(db, employee.email, employee.user_id, true);
      if (user?.id === context.user.id) throw new Error("Você não pode remover o seu próprio acesso.");
      if (user) await setAccountRole(entities, user, "user");
      await entities.Employee.delete(employee.id);
      return { removed: true };
    });
  });

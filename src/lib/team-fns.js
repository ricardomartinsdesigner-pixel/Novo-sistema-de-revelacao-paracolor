import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { toArray } from "@/lib/collection-utils";

function requireAdmin(user) {
  if (user?.role !== "admin") throw new Error("Apenas administradores podem gerenciar a equipe.");
}

async function findUserByEmail(role, email) {
  const users = toArray(await role.entities.User.list());
  return users.find((item) => String(item.email || "").toLowerCase() === email) ?? null;
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
    return { exists: Boolean(await findUserByEmail(role, email)) };
  });

// Vincula a conta criada pelo fluxo de cadastro da plataforma, sem enviar convite.
export const registerEmployee = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(EmployeeInput)
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const role = context.getBase44().asServiceRole;
    const email = data.email.trim().toLowerCase();

    const existing = await role.entities.Employee.filter({ email }, { limit: 1 });
    if (existing.items?.length) throw new Error("Este e-mail já está cadastrado na equipe.");

    const user = await findUserByEmail(role, email);
    if (!user) throw new Error("Conclua a criação da conta e a confirmação do e-mail antes de liberar o acesso.");
    if (user.role !== "admin") {
      await role.entities.User.update(user.id, { role: "admin" });
    }

    const employee = await role.entities.Employee.create({
      name: data.name.trim(),
      email,
      phone: data.phone ?? "",
      job_title: data.job_title?.trim() || "Funcionário",
      user_id: user?.id ?? "",
      active: true,
    });

    return { employee, has_access: true };
  });

// A senha é sempre criada pelo próprio funcionário: aqui só reenviamos o convite.
export const resendEmployeeInvite = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const employee = await context.getBase44().asServiceRole.entities.Employee.get(data.id);
    await context.getBase44().users.inviteUser(employee.email, "admin");
    return { sent: true };
  });

export const setEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const role = context.getBase44().asServiceRole;
    const employee = await role.entities.Employee.get(data.id);

    if (!data.active && employee.user_id && employee.user_id === context.user.id) {
      throw new Error("Você não pode bloquear o seu próprio acesso.");
    }

    const user = await findUserByEmail(role, employee.email);
    if (user) {
      await role.entities.User.update(user.id, { role: data.active ? "admin" : "user" });
    }

    return role.entities.Employee.update(employee.id, { active: data.active, user_id: user?.id ?? employee.user_id ?? "" });
  });

export const removeEmployee = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const role = context.getBase44().asServiceRole;
    const employee = await role.entities.Employee.get(data.id);

    if (employee.user_id && employee.user_id === context.user.id) {
      throw new Error("Você não pode remover o seu próprio acesso.");
    }

    const user = await findUserByEmail(role, employee.email);
    if (user && user.role === "admin") {
      await role.entities.User.update(user.id, { role: "user" });
    }

    await role.entities.Employee.delete(employee.id);
    return { removed: true };
  });

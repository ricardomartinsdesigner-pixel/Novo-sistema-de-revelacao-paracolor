import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { makeServerBase44 } from "@/lib/vps/server-client.server";
import { userFromRequest } from "@/lib/vps/session.server";

export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const user = await userFromRequest(request);
  return next({ context: { user, getBase44: () => makeServerBase44(request, user) } });
});

export const base44RequestMiddleware = createMiddleware({ type: "request" }).server(async ({ next, request }) => {
  const user = await userFromRequest(request);
  return next({ context: { user, getBase44: () => makeServerBase44(request, user) } });
});

export const requireUser = createMiddleware({ type: "function" }).server(async ({ next, context }) => {
  const user = context.user || await userFromRequest(getRequest());
  if (!user) {
    setResponseStatus(401);
    throw Object.assign(new Error("Faça login para continuar."), { status: 401, code: "UNAUTHORIZED" });
  }
  return next({ context: { user } });
});

export const requireUserRoute = createMiddleware({ type: "request" }).server(async ({ next, context }) => {
  const user = context.user || await userFromRequest(getRequest());
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return next({ context: { user } });
});

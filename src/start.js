import { createStart } from "@tanstack/react-start";
import { authMiddleware, base44RequestMiddleware } from "@/lib/auth-middleware";

// Each request receives the signed-in VPS user and the self-hosted entity adapter.
export const startInstance = createStart(() => ({
  requestMiddleware: [base44RequestMiddleware],
  functionMiddleware: [authMiddleware],
}));

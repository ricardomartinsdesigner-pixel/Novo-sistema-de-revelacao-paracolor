import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

function adminOnly(context) {
  if (context.user?.role !== "admin") throw new Error("Apenas administradores podem atualizar o sistema.");
}

export const checkGithubUpdate = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    adminOnly(context);
    const { checkLatestGithubUpdate } = await import("@/lib/github-updates.server");
    return checkLatestGithubUpdate();
  });

export const installGithubUpdate = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }))
  .handler(async ({ data, context }) => {
    adminOnly(context);
    const { installGithubUpdateVersion } = await import("@/lib/github-updates.server");
    return installGithubUpdateVersion(data.version);
  });

import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  environments: {
    ssr: { build: { rollupOptions: { input: "./src/entry-server.js" } } },
  },
  plugins: [tanstackStart({ srcDirectory: "src" }), react(), nitro()],
});

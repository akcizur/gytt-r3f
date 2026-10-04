import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/gytt-r3f/" : "/",
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1200 },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 }
});
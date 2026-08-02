import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const basePath = process.env.BASE_PATH ?? "/";
export default defineConfig({
  base: basePath,
  plugins: [react()],
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
  },
});

import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {emptyOutDir:true},
  server: { allowedHosts: ["terminal.local"] },
});

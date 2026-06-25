import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 3000,
    allowedHosts: true,
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

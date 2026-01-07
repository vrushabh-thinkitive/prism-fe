import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Only expose Vite env variables to the client
  envPrefix: "VITE_",

  server: {
    port: 4000,
  },

  build: {
    sourcemap: true,
  },
});

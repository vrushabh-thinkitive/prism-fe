import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3018"
    ),
  },
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Göreli yollar: üretim derlemesi Tauri içinde dosyadan yüklenir.
  base: "./",
  clearScreen: false,
  server: { port: 5173, strictPort: true },
});

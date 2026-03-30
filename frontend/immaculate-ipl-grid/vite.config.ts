import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  server: {
    allowedHosts: [
      ".ngrok-free.dev"
    ],

    proxy: {

      "/grid": {
        target: "http://localhost:3000",
        changeOrigin: true
      },

      "/grid_answers": {
        target: "http://localhost:3000",
        changeOrigin: true
      },

      "/validate": {
        target: "http://localhost:3000",
        changeOrigin: true
      },

      "/completion": {
        target: "http://localhost:3000",
        changeOrigin: true
      },

      "/giveup": {
        target: "http://localhost:3000",
        changeOrigin: true
      },

      "/rarity_score": {
  target: "http://localhost:3000",
  changeOrigin: true
},

"/players": {
  target: "http://localhost:3000",
  changeOrigin: true
}

    }
  }
})
import { defineConfig } from "vite";

export default defineConfig({
  base: "/SpaceZdesigns/",
  server: {
    host: "0.0.0.0"
  },
  build: {
    target: "es2022",
    sourcemap: true
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
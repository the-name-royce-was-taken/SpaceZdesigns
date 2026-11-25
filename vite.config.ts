import { defineConfig } from "vitest/config";

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
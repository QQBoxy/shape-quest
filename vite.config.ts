import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "/shape-quest/",
  build: { target: "es2022" },
  test: { include: ["tests/unit/**/*.test.ts"] },
});

import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/video-integration",
  timeout: 180000,
  workers: 1,
  fullyParallel: false,
  outputDir: "test-results-video",
  use: { ...base.use, trace: "off", viewport: { width: 1280, height: 900 } },
});

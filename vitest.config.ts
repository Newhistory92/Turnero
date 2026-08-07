import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    setupFiles: ["./tests/setup.ts"],
    // Los tests de integracion comparten la misma base: si corren en paralelo
    // se pisan los deleteMany() entre si.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})

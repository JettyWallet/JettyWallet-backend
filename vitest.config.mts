import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        // Una vez antes de todos los tests: prepara la base de test.
        globalSetup: ["tests/setup/global-setup.ts"],
        // Antes de cada archivo de test: variables de entorno.
        setupFiles: ["tests/setup/env.ts"],
        // Los tests de integración comparten una sola base de datos,
        // así que los archivos corren de a uno.
        fileParallelism: false,
    },
});

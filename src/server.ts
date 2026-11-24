/*  Punto de entrada del servidor.

    Carga las variables de entorno, verifica que estén las obligatorias y que
    la base de datos responda, y recién entonces empieza a escuchar. Si algo
    falla, el proceso termina con un mensaje claro en vez de arrancar roto. */

import "dotenv/config";
import app from "./app";
import { env } from "./config/env";
import { checkDatabaseConnection } from "./config/database";

// Sin estas variables la API no puede funcionar: mejor no arrancar
// que descubrirlo recién cuando alguien intenta iniciar sesión.
const REQUIRED_ENV = {
    DATABASE_URL: env.databaseUrl,
    JWT_SECRET: env.jwtSecret,
};

const start = async (): Promise<void> => {
    const missing = Object.entries(REQUIRED_ENV)
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
    }

    await checkDatabaseConnection();
    console.log("Conexión con PostgreSQL establecida");

    app.listen(env.port, () => {
        console.log(`Servidor JettyWallet funcionando en http://localhost:${env.port}`);
        console.log(`Documentación de la API en http://localhost:${env.port}/api-docs`);
    });
};

start().catch((error) => {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
});

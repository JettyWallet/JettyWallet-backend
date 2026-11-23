/*  Se ejecuta una sola vez antes de todos los tests.

    Si hay DATABASE_URL_TEST, deja la base de test con el esquema exacto de las
    migraciones: borra el schema public y corre `migrate:up` desde cero.
    Así los tests siempre corren contra el mismo esquema que producción.

    Por seguridad, solo acepta bases cuyo nombre termine en "_test": es
    imposible que esto borre la base de desarrollo por un error de configuración. */

import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";

export default async function setup(): Promise<void> {
    const testUrl = process.env.DATABASE_URL_TEST;

    if (!testUrl) {
        console.warn(
            "\n[tests] DATABASE_URL_TEST no está configurada: " +
            "se saltean los tests que necesitan base de datos.\n"
        );
        return;
    }

    const databaseName = new URL(testUrl).pathname.replace(/^\//, "");

    if (!databaseName.endsWith("_test")) {
        throw new Error(
            `[tests] La base de test debe terminar en "_test" (se recibió "${databaseName}"). ` +
            "Se frena para no borrar datos de otra base."
        );
    }

    const client = new Client({ connectionString: testUrl });
    await client.connect();

    try {
        await client.query("DROP SCHEMA public CASCADE");
        await client.query("CREATE SCHEMA public");
    } finally {
        await client.end();
    }

    // Mismo comando que `npm run migrate:up`, apuntando a la base de test.
    const root = path.resolve(__dirname, "../..");

    execFileSync(
        process.execPath,
        [
            path.join(root, "node_modules/node-pg-migrate/bin/node-pg-migrate.js"),
            "up",
            "--migrations-dir", path.join(root, "migrations"),
            "--migration-file-language", "sql",
        ],
        {
            cwd: root,
            env: { ...process.env, DATABASE_URL: testUrl },
            stdio: "pipe",
        }
    );
}

/*  Se ejecuta antes de cada archivo de test, antes de importar la app.

    Los tests NUNCA usan la base de desarrollo: DATABASE_URL se reemplaza por
    DATABASE_URL_TEST. Si no hay base de test configurada, DATABASE_URL queda
    vacía y los tests que necesitan base se saltean (ver tests/helpers/db.ts). */

import "dotenv/config";

process.env.NODE_ENV = "test";

if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
} else {
    delete process.env.DATABASE_URL;
}

// Secreto fijo para los tests de autenticación.
process.env.JWT_SECRET ??= "secreto-solo-para-tests";

// Los tests NUNCA llaman a APIs externas: no gastan el cupo mensual de las
// APIs de cotizaciones ni dependen de internet. Las claves se vacían y fetch
// falla siempre. El test que necesite una API la simula con vi.stubGlobal
// (ver tests/helpers/rates.ts); al hacer vi.unstubAllGlobals vuelve este fetch.
process.env.CURRENCY_FREAKS_API_KEY = "";
process.env.FIXER_API_KEY = "";

globalThis.fetch = async (input) => {
    throw new Error(`fetch real deshabilitado en los tests: ${String(input)}`);
};

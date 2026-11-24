/*  Variables de entorno de la aplicación, leídas en un solo lugar.

    El resto del código importa `env` en vez de leer process.env directamente,
    así cada variable tiene un nombre, un tipo y un valor por defecto claros.
    Las variables obligatorias se validan al arrancar el servidor (server.ts),
    no acá, para que los tests puedan importar la app sin tener todo definido. */

const parseList = (value: string | undefined, fallback: string[]): string[] => {
    if (!value) return fallback;

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

export const env = {
    nodeEnv: process.env.NODE_ENV ?? "development",

    port: Number(process.env.PORT) || 3000,

    databaseUrl: process.env.DATABASE_URL,

    // Orígenes permitidos por CORS. Admite varios separados por coma,
    // por ejemplo: "http://localhost:5173,https://jetty.vercel.app".
    frontendUrls: parseList(process.env.FRONTEND_URL, ["http://localhost:5173"]),

    jwtSecret: process.env.JWT_SECRET,
    currencyFreaksApiKey: process.env.CURRENCY_FREAKS_API_KEY,
    fixerApiKey: process.env.FIXER_API_KEY,
};

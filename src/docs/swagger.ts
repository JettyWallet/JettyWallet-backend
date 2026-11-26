/*  Especificación OpenAPI generada a partir de las anotaciones @swagger
    de los archivos de rutas. Se publica en /api-docs. */

import path from "path";
import swaggerJsdoc from "swagger-jsdoc";

// swagger-jsdoc busca los archivos con patrones glob, que solo aceptan "/".
// En Windows path.join devuelve "\", por eso se normaliza.
const fromHere = (pattern: string): string =>
    path.join(__dirname, pattern).replace(/\\/g, "/");

export const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "JettyWallet API",
            version: "1.0.0",
            description: "API de la billetera virtual JettyWallet",
        },
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "jetty_session",
                    description:
                        "Cookie httpOnly que setean login y register. El navegador la manda sola.",
                },
                // Transición: se acepta hasta que el front pase a la cookie.
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Temporal, mientras el front migra a la cookie.",
                },
            },
            headers: {
                SessionCookie: {
                    description:
                        "jetty_session=<JWT>; HttpOnly; SameSite=Lax; Secure (en producción); Path=/; Max-Age=3600",
                    schema: { type: "string" },
                },
            },
            schemas: {
                Error: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                    },
                },
                User: {
                    type: "object",
                    properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string", example: "Ana Pérez" },
                        email: { type: "string", example: "ana@mail.com" },
                    },
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        token: {
                            type: "string",
                            description:
                                "Temporal: el mismo JWT de la cookie, para el front que todavía usa Bearer. Se va a quitar.",
                        },
                        user: { $ref: "#/components/schemas/User" },
                    },
                },
                Rates: {
                    type: "object",
                    properties: {
                        base: { type: "string", example: "USD" },
                        usdRates: {
                            type: "object",
                            description: "Cuántos USD vale 1 unidad de cada moneda",
                            additionalProperties: { type: "number" },
                            example: { ARS: 0.00069, COP: 0.00026, EUR: 1.16, USD: 1 },
                        },
                        updatedAt: {
                            type: "string",
                            format: "date-time",
                            description: "Fecha de la cotización más vieja de la lista",
                        },
                        stale: {
                            type: "boolean",
                            description: "true si no se pudieron renovar y son de hace más de 1 hora",
                        },
                    },
                },
                WalletSummary: {
                    type: "object",
                    properties: {
                        balances: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    currency: { type: "string", example: "USD" },
                                    amount: { type: "number", example: 1000 },
                                },
                            },
                        },
                        usdRates: {
                            type: "object",
                            description: "Cuántos USD vale 1 unidad de cada moneda",
                            additionalProperties: { type: "number" },
                            example: { ARS: 0.00069, COP: 0.00026, EUR: 1.16, USD: 1 },
                        },
                        change24h: {
                            type: "number",
                            description: "Variación del total en 24 h, en %. Por ahora siempre 0.",
                            example: 0,
                        },
                    },
                },
                Transaction: {
                    type: "object",
                    properties: {
                        id: { type: "string", format: "uuid" },
                        type: {
                            type: "string",
                            enum: ["deposit", "exchange", "transfer_in", "transfer_out"],
                        },
                        fromCurrency: {
                            type: "string",
                            nullable: true,
                            description: "null en depósitos",
                        },
                        fromAmount: { type: "number", nullable: true, description: "null en depósitos" },
                        toCurrency: { type: "string", example: "ARS" },
                        toAmount: { type: "number", example: 50000 },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                DepositResponse: {
                    type: "object",
                    properties: {
                        transaction: { $ref: "#/components/schemas/Transaction" },
                        balance: {
                            type: "object",
                            description: "Saldo de esa moneda después del depósito",
                            properties: {
                                currency: { type: "string", example: "ARS" },
                                amount: { type: "number", example: 50000 },
                            },
                        },
                    },
                },
            },
        },
    },
    // Rutas relativas a este archivo: funcionan igual en desarrollo (src/*.ts)
    // y en producción (dist/*.js).
    apis: [
        fromHere("../routes/*.{ts,js}"),
        // Rutas de cada módulo (auth/, wallet/, ...): *.routes.ts
        fromHere("../*/*.routes.{ts,js}"),
    ],
});

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
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                Error: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                    },
                },
            },
        },
    },
    // Rutas relativas a este archivo: funcionan igual en desarrollo (src/*.ts)
    // y en producción (dist/*.js).
    apis: [
        fromHere("../routes/*.{ts,js}"),
        fromHere("../auth/*.routes.{ts,js}"),
    ],
});

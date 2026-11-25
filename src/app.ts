/*  Configuración de la aplicación Express.

    Este archivo arma la app pero no la pone a escuchar: eso lo hace server.ts.
    Así los tests pueden importar la app y probarla con supertest sin levantar
    un servidor real. */

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./docs/swagger";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { originCheck } from "./middlewares/origin.middleware";

const app = express();

// credentials: true permite que el navegador mande y reciba la cookie de sesión
// cuando el front llama directo a la API desde otro origen (local sin proxy).
app.use(cors({ origin: env.frontendUrls, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", originCheck, routes);

// Siempre al final: primero las rutas inexistentes, después los errores.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

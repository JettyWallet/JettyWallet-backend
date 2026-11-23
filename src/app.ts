/*  Configuración de la aplicación Express.

    Este archivo arma la app pero no la pone a escuchar: eso lo hace server.ts.
    Así los tests pueden importar la app y probarla con supertest sin levantar
    un servidor real. */

import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./docs/swagger";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors({ origin: env.frontendUrls }));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", routes);

// Siempre al final: primero las rutas inexistentes, después los errores.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

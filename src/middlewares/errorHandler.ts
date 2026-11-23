/*  Manejo centralizado de errores.

    Todas las respuestas de error de la API tienen la misma forma:
        { "message": "texto para mostrar al usuario" }

    Express 5 envía a este middleware tanto los errores lanzados con throw como
    las promesas rechazadas de los controladores async, así que en los
    controladores no hace falta try/catch: alcanza con lanzar un AppError. */

import { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../utils/appError";

// Rutas que no existen. Se registra después de todas las rutas.
export const notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).json({
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    });
};

// Errores lanzados en cualquier parte de la petición. Se registra al final de todo.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }

    // Cuerpo con JSON mal formado (lo detecta express.json()).
    if (error?.type === "entity.parse.failed") {
        res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido" });
        return;
    }

    // Error inesperado: se registra completo en el servidor, pero al cliente
    // no se le muestran detalles internos.
    console.error(error);

    res.status(500).json({ message: "Error interno del servidor" });
};

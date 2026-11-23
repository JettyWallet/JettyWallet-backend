/*  Comportamiento general de la app: rutas base, CORS y formato de errores.
    No necesitan base de datos. */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { errorHandler } from "../src/middlewares/errorHandler";
import { AppError } from "../src/utils/appError";

describe("app", () => {
    it("GET /api/health responde que la API funciona", async () => {
        const res = await request(app).get("/api/health");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
    });

    it("una ruta inexistente responde 404 con { message }", async () => {
        const res = await request(app).get("/api/no-existe");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: "Ruta no encontrada: GET /api/no-existe" });
    });

    it("un JSON mal formado responde 400 con { message }", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set("Content-Type", "application/json")
            .send("{ esto no es json");

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "El cuerpo de la petición no es un JSON válido" });
    });

    it("CORS permite el origen del frontend", async () => {
        const res = await request(app)
            .get("/api/health")
            .set("Origin", "http://localhost:5173");

        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });

    it("CORS no habilita otros orígenes", async () => {
        const res = await request(app)
            .get("/api/health")
            .set("Origin", "https://sitio-desconocido.com");

        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
});

describe("errorHandler", () => {
    // App mínima para probar el manejador con errores controlados.
    const buildApp = (error: unknown) => {
        const testApp = express();
        testApp.get("/", async () => {
            throw error;
        });
        testApp.use(errorHandler);
        return testApp;
    };

    it("un AppError responde con su status y mensaje", async () => {
        const res = await request(buildApp(new AppError("Saldo insuficiente", 422))).get("/");

        expect(res.status).toBe(422);
        expect(res.body).toEqual({ message: "Saldo insuficiente" });
    });

    it("un error inesperado responde 500 sin exponer detalles", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const res = await request(buildApp(new Error("detalle interno"))).get("/");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: "Error interno del servidor" });
        expect(consoleError).toHaveBeenCalled();

        consoleError.mockRestore();
    });
});

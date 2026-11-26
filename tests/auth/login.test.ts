/*  Login de usuarios contra PostgreSQL real.
    Se saltean si no hay DATABASE_URL_TEST configurada. */

import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, resetDatabase } from "../helpers/db";
import { sessionToken } from "../helpers/session";

const validUser = {
    name: "Ana Pérez",
    email: "ana@mail.com",
    password: "12345678",
};

describe.skipIf(!hasTestDatabase)("POST /api/auth/login", () => {
    beforeEach(async () => {
        await resetDatabase();
        await request(app).post("/api/auth/register").send(validUser);
    });
    afterAll(closeDatabase);

    it("con credenciales válidas devuelve solo el usuario (el token va en la cookie)", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: validUser.email, password: validUser.password });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            user: { id: expect.any(String), name: "Ana Pérez", email: "ana@mail.com" },
        });
        expect(sessionToken(res)).toBeDefined();
    });

    it("el token de la cookie contiene el id del usuario", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: validUser.email, password: validUser.password });

        const payload = jwt.verify(sessionToken(res)!, process.env.JWT_SECRET!) as {
            userId: string;
        };
        expect(payload.userId).toBe(res.body.user.id);
    });

    it("normaliza el email (espacios y mayúsculas)", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "  ANA@mail.com ", password: validUser.password });

        expect(res.status).toBe(200);
    });

    it("con contraseña incorrecta responde 401", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: validUser.email, password: "otra-clave" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Credenciales incorrectas" });
    });

    it("con un email inexistente responde el mismo 401 (no revela qué emails existen)", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "no-existe@mail.com", password: validUser.password });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Credenciales incorrectas" });
    });

    it("sin email o contraseña responde 400", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: validUser.email });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "Ingresá email y contraseña" });
    });
});

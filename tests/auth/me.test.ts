/*  Middleware de autenticación y GET /api/me.
    Los casos sin sesión o con sesión inválida no necesitan base de datos.
    Los que leen el usuario se saltean si no hay DATABASE_URL_TEST configurada. */

import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, resetDatabase } from "../helpers/db";
import { sessionCookie } from "../helpers/session";

const validUser = {
    name: "Ana Pérez",
    email: "ana@mail.com",
    password: "12345678",
};

const secret = () => process.env.JWT_SECRET!;

const getMeWithCookie = (token: string) =>
    request(app).get("/api/me").set("Cookie", sessionCookie(token));

describe("GET /api/me sin base de datos", () => {
    it("sin cookie de sesión responde 401", async () => {
        const res = await request(app).get("/api/me");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token no enviado" });
    });

    it("un token válido por header Bearer ya no se acepta: solo cookie", async () => {
        const token = jwt.sign({ userId: randomUUID() }, secret());

        const res = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token no enviado" });
    });

    it("con un token mal formado responde 401", async () => {
        const res = await getMeWithCookie("falso");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o vencido" });
    });

    it("con un token firmado con otro secreto responde 401", async () => {
        const token = jwt.sign({ userId: "00000000-0000-0000-0000-000000000000" }, "otro-secreto");

        const res = await getMeWithCookie(token);

        expect(res.status).toBe(401);
    });

    it("con un token vencido responde 401", async () => {
        const token = jwt.sign({ userId: "00000000-0000-0000-0000-000000000000" }, secret(), {
            expiresIn: -10,
        });

        const res = await getMeWithCookie(token);

        expect(res.status).toBe(401);
    });

    it("con un token válido pero sin userId responde 401", async () => {
        const token = jwt.sign({ otro: "dato" }, secret());

        const res = await getMeWithCookie(token);

        expect(res.status).toBe(401);
    });
});

describe.skipIf(!hasTestDatabase)("GET /api/me con base de datos", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("con la cookie del login devuelve el usuario de la sesión", async () => {
        const browser = request.agent(app);
        await browser.post("/api/auth/register").send(validUser);
        const login = await browser
            .post("/api/auth/login")
            .send({ email: validUser.email, password: validUser.password });

        const res = await browser.get("/api/me");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: login.body.user.id,
            name: "Ana Pérez",
            email: "ana@mail.com",
        });
    });

    it("si el usuario del token no existe en la base responde 401", async () => {
        const res = await getMeWithCookie(jwt.sign({ userId: randomUUID() }, secret()));

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o vencido" });
    });
});

/*  Sesión en cookie httpOnly: login, register, logout, /me con cookie,
    CORS con credenciales y chequeo de Origin.
    Los casos que necesitan usuarios se saltean si no hay DATABASE_URL_TEST. */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { SESSION_COOKIE } from "../../src/auth/session";
import { env } from "../../src/config/env";
import { closeDatabase, hasTestDatabase, resetDatabase } from "../helpers/db";
import { sessionCookieHeader, sessionToken } from "../helpers/session";

const validUser = {
    name: "Ana Pérez",
    email: "ana@mail.com",
    password: "12345678",
};

const FRONT_ORIGIN = env.frontendUrls[0];

describe("sesión sin base de datos", () => {
    it("logout responde 204 y borra la cookie, aunque no haya sesión", async () => {
        const res = await request(app).post("/api/auth/logout");

        expect(res.status).toBe(204);
        const cookie = sessionCookieHeader(res);
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(cookie).toMatch(/HttpOnly/);
    });

    it("/me con una cookie inválida responde 401", async () => {
        const res = await request(app)
            .get("/api/me")
            .set("Cookie", `${SESSION_COOKIE}=no-es-un-jwt`);

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o vencido" });
    });

    it("CORS permite credenciales para el origen del front", async () => {
        const res = await request(app)
            .options("/api/auth/login")
            .set("Origin", FRONT_ORIGIN)
            .set("Access-Control-Request-Method", "POST");

        expect(res.headers["access-control-allow-origin"]).toBe(FRONT_ORIGIN);
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    describe("chequeo de Origin (CSRF)", () => {
        it("rechaza con 403 un POST desde un origen no permitido", async () => {
            const res = await request(app)
                .post("/api/auth/logout")
                .set("Origin", "https://sitio-malicioso.com");

            expect(res.status).toBe(403);
            expect(res.body).toEqual({ message: "Origen no permitido" });
        });

        it("acepta un POST desde el origen del front", async () => {
            const res = await request(app).post("/api/auth/logout").set("Origin", FRONT_ORIGIN);

            expect(res.status).toBe(204);
        });

        it("acepta un POST desde el propio dominio de la API (Swagger)", async () => {
            const res = await request(app)
                .post("/api/auth/logout")
                .set("Host", "api.jetty.test")
                .set("Origin", "https://api.jetty.test");

            expect(res.status).toBe(204);
        });

        it("no afecta a los GET desde otros orígenes", async () => {
            const res = await request(app)
                .get("/api/health")
                .set("Origin", "https://sitio-malicioso.com");

            expect(res.status).toBe(200);
        });
    });
});

describe.skipIf(!hasTestDatabase)("sesión con cookie", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("register setea la cookie de sesión httpOnly", async () => {
        const res = await request(app).post("/api/auth/register").send(validUser);

        expect(res.status).toBe(201);
        const cookie = sessionCookieHeader(res);
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Lax/);
        expect(cookie).toMatch(/Path=\//);
        expect(cookie).toMatch(/Max-Age=3600/);
        // En los tests NODE_ENV no es production: sin Secure, como en local.
        expect(cookie).not.toMatch(/Secure/);
        // Sin Domain: queda asociada al dominio que la recibe.
        expect(cookie).not.toMatch(/Domain=/);
    });

    it("login setea la cookie y no devuelve el token en el body", async () => {
        await request(app).post("/api/auth/register").send(validUser);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: validUser.email, password: validUser.password });

        expect(res.status).toBe(200);
        expect(sessionToken(res)).toBeDefined();
        expect(res.body).not.toHaveProperty("token");
    });

    it("login fallido no setea la cookie", async () => {
        await request(app).post("/api/auth/register").send(validUser);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: validUser.email, password: "otra-clave" });

        expect(res.status).toBe(401);
        expect(sessionCookieHeader(res)).toBeUndefined();
    });

    it("flujo completo con cookie: register, /me, logout y /me de nuevo", async () => {
        // El agent guarda y reenvía las cookies, como un navegador.
        const browser = request.agent(app);

        await browser.post("/api/auth/register").send(validUser).expect(201);

        const me = await browser.get("/api/me");
        expect(me.status).toBe(200);
        expect(me.body).toMatchObject({ name: "Ana Pérez", email: "ana@mail.com" });

        await browser.post("/api/auth/logout").expect(204);

        const afterLogout = await browser.get("/api/me");
        expect(afterLogout.status).toBe(401);
        expect(afterLogout.body).toEqual({ message: "Token no enviado" });
    });

    it("las rutas protegidas también aceptan la cookie (summary)", async () => {
        const browser = request.agent(app);
        await browser.post("/api/auth/register").send(validUser).expect(201);

        const res = await browser.get("/api/wallet/summary");

        expect(res.status).toBe(200);
        expect(res.body.balances).toHaveLength(4);
    });

    it("el token de la sesión mandado por header Bearer no se acepta", async () => {
        const res = await request(app).post("/api/auth/register").send(validUser);

        const me = await request(app)
            .get("/api/me")
            .set("Authorization", `Bearer ${sessionToken(res)}`);

        expect(me.status).toBe(401);
    });
});

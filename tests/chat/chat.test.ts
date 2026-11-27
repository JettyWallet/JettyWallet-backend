import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, resetDatabase } from "../helpers/db";

const PASSWORD = "clave-segura-123";

// Registra un usuario nuevo y devuelve un agente con la sesión iniciada (cookie).
async function loggedInAgent() {
  const agent = request.agent(app);
  const email = `chat${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`;
  await agent
    .post("/api/auth/register")
    .send({ name: "Chat Test", email, password: PASSWORD });
  await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  return agent;
}

function mockGemini(text: string) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
      { status: 200 }
    )
  );
}

describe.skipIf(!hasTestDatabase)("POST /api/chat", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("sin sesión responde 401", async () => {
    const res = await request(app).post("/api/chat").send({ message: "hola" });
    expect(res.status).toBe(401);
  });

  it("mensaje vacío responde 400", async () => {
    const agent = await loggedInAgent();
    const res = await agent.post("/api/chat").send({ message: "   " });
    expect(res.status).toBe(400);
  });

  it("mensaje de más de 500 caracteres responde 400", async () => {
    const agent = await loggedInAgent();
    const res = await agent.post("/api/chat").send({ message: "a".repeat(501) });
    expect(res.status).toBe(400);
  });

  it("devuelve la respuesta de Gemini", async () => {
    const agent = await loggedInAgent();
    mockGemini("Podés depositar desde la app.");
    const res = await agent.post("/api/chat").send({ message: "¿Cómo deposito?" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "Podés depositar desde la app." });
  });

  it("envía las instrucciones fijas del servidor y el mensaje del usuario", async () => {
    const agent = await loggedInAgent();
    const spy = mockGemini("ok");
    await agent.post("/api/chat").send({ message: "hola" });
    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.systemInstruction.parts[0].text).toContain("JettyWallet");
    expect(body.contents[0].parts[0].text).toBe("hola");
  });

  it("si Gemini falla responde 503", async () => {
    const agent = await loggedInAgent();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error", { status: 500 }));
    const res = await agent.post("/api/chat").send({ message: "hola" });
    expect(res.status).toBe(503);
  });

  it("el mensaje número 11 en un minuto responde 429", async () => {
    const agent = await loggedInAgent();
    mockGemini("ok");
    for (let i = 0; i < 10; i++) {
      await agent.post("/api/chat").send({ message: "hola" });
    }
    const res = await agent.post("/api/chat").send({ message: "hola" });
    expect(res.status).toBe(429);
  });
});
/*  Notificaciones con un cliente de SES simulado: no se manda ningún mail real. */

import type { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env";
import {
    notifyDeposit,
    notifyExchange,
    notifyTransferReceived,
    notifyTransferSent,
    setSesClient,
} from "../../src/notifications/notification.service";

const ana = { email: "ana@mail.com", name: "Ana Pérez" };

const fakeClient = () => {
    const send = vi.fn().mockResolvedValue({});
    return { client: { send } as unknown as SESClient, send };
};

const sentCommand = (send: ReturnType<typeof vi.fn>): SendEmailCommand =>
    send.mock.calls[0][0] as SendEmailCommand;

describe("notificaciones por mail (SES simulado)", () => {
    let fake: ReturnType<typeof fakeClient>;
    let originalFrom: string | undefined;

    beforeEach(() => {
        fake = fakeClient();
        setSesClient(fake.client);
        originalFrom = env.sesFromEmail;
        env.sesFromEmail = "no-reply@jetty.test";
    });

    afterEach(() => {
        setSesClient(null);
        env.sesFromEmail = originalFrom;
        vi.restoreAllMocks();
    });

    it("notifyDeposit envía el mail al destinatario desde el remitente configurado", async () => {
        await notifyDeposit(ana, { amount: 500, currency: "ARS" });

        expect(fake.send).toHaveBeenCalledTimes(1);
        const input = sentCommand(fake.send).input;
        expect(input.Source).toBe("no-reply@jetty.test");
        expect(input.Destination?.ToAddresses).toEqual(["ana@mail.com"]);
        expect(input.Message?.Subject?.Data).toBe("Depósito recibido");
        expect(input.Message?.Body?.Text?.Data).toBe(
            "Hola Ana Pérez, acreditamos un depósito de 500 ARS en tu billetera de Jetty."
        );
    });

    it("notifyDeposit muestra los montos con formato es-AR", async () => {
        await notifyDeposit(ana, { amount: 1_600_000.5, currency: "ARS" });

        const body = sentCommand(fake.send).input.Message?.Body?.Text?.Data;
        expect(body).toContain("1.600.000,50 ARS");
    });

    it("notifyExchange incluye montos, monedas y cotización", async () => {
        await notifyExchange(ana, {
            amountFrom: 100,
            currencyFrom: "USD",
            amountTo: 160_550,
            currencyTo: "ARS",
            rate: 1605.5,
        });

        const body = sentCommand(fake.send).input.Message?.Body?.Text?.Data;
        expect(body).toBe(
            "Hola Ana Pérez, cambiaste 100 USD por 160.550 ARS (1 USD = 1.605,5 ARS)."
        );
    });

    it("notifyExchange redondea la cotización sin perder las cotizaciones chicas", async () => {
        await notifyExchange(ana, {
            amountFrom: 50_000,
            currencyFrom: "ARS",
            amountTo: 31.14,
            currencyTo: "USD",
            rate: 0.000622858922454,
        });

        const body = sentCommand(fake.send).input.Message?.Body?.Text?.Data;
        expect(body).toContain("(1 ARS = 0,000622859 USD)");
    });

    it("notifyTransferSent indica a quién se envió", async () => {
        await notifyTransferSent(ana, { amount: 20, currency: "EUR", recipientName: "Bruno Gil" });

        const body = sentCommand(fake.send).input.Message?.Body?.Text?.Data;
        expect(body).toContain("enviaste 20 EUR a Bruno Gil");
    });

    it("notifyTransferReceived indica quién envió", async () => {
        await notifyTransferReceived(ana, { amount: 20, currency: "EUR", senderName: "Bruno Gil" });

        const body = sentCommand(fake.send).input.Message?.Body?.Text?.Data;
        expect(body).toContain("Bruno Gil te envió 20 EUR");
    });

    it("si SES falla, la función no lanza error y lo loguea", async () => {
        fake.send.mockRejectedValueOnce(new Error("SES caído"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(notifyDeposit(ana, { amount: 1, currency: "USD" })).resolves.toBeUndefined();
        expect(consoleError).toHaveBeenCalled();
    });

    it("sin SES_FROM_EMAIL no envía y lo loguea", async () => {
        env.sesFromEmail = undefined;
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        await notifyDeposit(ana, { amount: 1, currency: "USD" });

        expect(fake.send).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
    });
});

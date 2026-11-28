/*  Notificaciones por mail con AWS SES.

    Reglas:
    - Ninguna función lanza error. Si SES falla, se loguea y se sigue:
      una operación de dinero nunca se cae por un mail.
    - Se llaman después de confirmar la operación en la base.
    - El cliente de SES se puede reemplazar con setSesClient (lo usan los tests). */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "../config/env";

export interface Recipient {
    email: string;
    name: string;
}

let client: SESClient | null = null;

// Permite reemplazar el cliente (tests). Con null, se vuelve a crear desde el .env.
export const setSesClient = (newClient: SESClient | null): void => {
    client = newClient;
};

const getClient = (): SESClient => {
    if (!client) {
        client = new SESClient({
            region: env.awsRegion,
            credentials: {
                accessKeyId: env.awsAccessKeyId ?? "",
                secretAccessKey: env.awsSecretAccessKey ?? "",
            },
        });
    }
    return client;
};

const formatAmount = (amount: number): string => amount.toFixed(2);

const sendMail = async (to: string, subject: string, body: string): Promise<void> => {
    try {
        if (!env.sesFromEmail) {
            console.error("SES_FROM_EMAIL no está configurado: no se envía el mail de notificación");
            return;
        }

        await getClient().send(
            new SendEmailCommand({
                Source: env.sesFromEmail,
                Destination: { ToAddresses: [to] },
                Message: {
                    Subject: { Data: subject, Charset: "UTF-8" },
                    Body: { Text: { Data: body, Charset: "UTF-8" } },
                },
            })
        );
    } catch (error) {
        console.error("No se pudo enviar el mail de notificación:", error);
    }
};

export const notifyDeposit = async (
    to: Recipient,
    data: { amount: number; currency: string }
): Promise<void> => {
    await sendMail(
        to.email,
        "Depósito recibido",
        `Hola ${to.name}, acreditamos un depósito de ${formatAmount(data.amount)} ${data.currency} en tu billetera de Jetty.`
    );
};

export const notifyExchange = async (
    to: Recipient,
    data: {
        amountFrom: number;
        currencyFrom: string;
        amountTo: number;
        currencyTo: string;
        rate: number;
    }
): Promise<void> => {
    await sendMail(
        to.email,
        "Intercambio realizado",
        `Hola ${to.name}, cambiaste ${formatAmount(data.amountFrom)} ${data.currencyFrom} ` +
        `por ${formatAmount(data.amountTo)} ${data.currencyTo} a una tasa de ${data.rate}.`
    );
};

export const notifyTransferSent = async (
    to: Recipient,
    data: { amount: number; currency: string; recipientName: string }
): Promise<void> => {
    await sendMail(
        to.email,
        "Transferencia enviada",
        `Hola ${to.name}, enviaste ${formatAmount(data.amount)} ${data.currency} a ${data.recipientName}.`
    );
};

export const notifyTransferReceived = async (
    to: Recipient,
    data: { amount: number; currency: string; senderName: string }
): Promise<void> => {
    await sendMail(
        to.email,
        "Recibiste una transferencia",
        `Hola ${to.name}, ${data.senderName} te envió ${formatAmount(data.amount)} ${data.currency}.`
    );
};

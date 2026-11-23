/*  Error de negocio con código HTTP.

    Los servicios y controladores lanzan AppError cuando la petición no se
    puede cumplir por un motivo conocido (datos inválidos, saldo insuficiente,
    recurso inexistente...). El errorHandler global lo convierte en la
    respuesta { message } con el status indicado.

    Cualquier otro error se considera inesperado y responde 500. */

export class AppError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
    }
}

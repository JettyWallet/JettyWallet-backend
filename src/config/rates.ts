/*  Cotizaciones de referencia: cuántos USD vale 1 unidad de cada moneda.

    Se usan solo cuando la base todavía no tiene una cotización guardada
    para esa moneda (por ejemplo, un entorno sin claves de las APIs de
    cotizaciones). Son valores aproximados: sirven para mostrar un total
    estimado, no para operar. Las operaciones con plata (intercambios) usan
    siempre la cotización real del servicio de monedas. */

export const REFERENCE_USD_RATES: Record<string, number> = {
    USD: 1,
    EUR: 1.16,
    ARS: 0.00069, // ≈ 1.450 ARS por USD
    COP: 0.00026, // ≈ 3.850 COP por USD
};

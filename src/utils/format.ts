/*  Formato de números para mostrar al usuario (mensajes de error y mails),
    con el formato argentino que usa el resto de la app: punto para los miles
    y coma para los decimales. */

const LOCALE = "es-AR";

/*  Montos de dinero. Sin decimales si es entero y con 2 si no los tiene:
    1600000 → "1.600.000", 857142.85 → "857.142,85", 10.5 → "10,50".
    Acepta texto porque PostgreSQL devuelve los NUMERIC como string. */
export const formatAmount = (value: number | string): string => {
    const amount = Number(value);
    const decimals = Number.isInteger(amount) ? 0 : 2;

    return amount.toLocaleString(LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/*  Cotizaciones, con 6 dígitos significativos. Con decimales fijos, las
    cotizaciones chicas se perderían (1 ARS = 0,000622859 USD daría "0,00"):
    1605.5 → "1.605,5", 0.000622858922 → "0,000622859", 3800 → "3.800". */
export const formatRate = (rate: number): string =>
    rate.toLocaleString(LOCALE, { maximumSignificantDigits: 6 });

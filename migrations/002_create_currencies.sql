-- Up Migration

/*  Catálogo de monedas que soporta Jetty: ARS, COP, EUR y USD.

    Todas las tablas con montos referencian esta tabla, así que no es posible
    guardar un saldo o un movimiento en una moneda que no exista acá.
    is_active permite deshabilitar una moneda sin borrarla (y sin romper el
    historial de movimientos que la usan). */

CREATE TABLE currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(5) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT currencies_code_format
        CHECK (code ~ '^[A-Z]{3}$')
);

INSERT INTO currencies (code, name, symbol) VALUES
    ('ARS', 'Peso argentino', '$'),
    ('COP', 'Peso colombiano', '$'),
    ('EUR', 'Euro', '€'),
    ('USD', 'Dólar estadounidense', 'US$');

-- Down Migration

DROP TABLE IF EXISTS currencies;

/* Migración 002: Crear las tablas de monedas y cotizaciones.
    currencies: catálogo de monedas fiat y cripto que soporta Jetty.
    exchange_rates: caché de las cotizaciones obtenidas de la API externa.
    Se guarda una sola fila por par de monedas; fetched_at indica cuándo se actualizó. */

CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('fiat', 'crypto')),
    decimals SMALLINT NOT NULL CHECK (decimals BETWEEN 0 AND 18),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency VARCHAR(10) NOT NULL REFERENCES currencies(code),
    quote_currency VARCHAR(10) NOT NULL REFERENCES currencies(code),
    rate NUMERIC(36, 18) NOT NULL CHECK (rate > 0),
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exchange_rates_pair_unique UNIQUE (base_currency, quote_currency),
    CONSTRAINT exchange_rates_distinct_pair CHECK (base_currency <> quote_currency)
);

INSERT INTO currencies (code, name, type, decimals) VALUES
    ('ARS', 'Peso argentino', 'fiat', 2),
    ('EUR', 'Euro', 'fiat', 2),
    ('USD', 'Dólar estadounidense', 'fiat', 2),
    ('BTC', 'Bitcoin', 'crypto', 8),
    ('USDT', 'Tether', 'crypto', 6)
ON CONFLICT (code) DO NOTHING;

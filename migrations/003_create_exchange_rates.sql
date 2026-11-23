-- Up Migration

/*  Caché de cotizaciones obtenidas de una API externa.

    Una fila por par de monedas: 1 unidad de base_currency = rate unidades de
    quote_currency. Al refrescar se hace UPSERT sobre el par, y fetched_at
    indica cuándo se obtuvo; el servicio decide si la cotización está vencida.

    rate usa 12 decimales porque algunos pares son muy chicos
    (por ejemplo, 1 COP ≈ 0,00025 USD). */

CREATE TABLE exchange_rates (
    base_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    quote_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    rate NUMERIC(24, 12) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (base_currency, quote_currency),

    CONSTRAINT exchange_rates_distinct_pair
        CHECK (base_currency <> quote_currency),

    CONSTRAINT exchange_rates_rate_positive
        CHECK (rate > 0)
);

-- Down Migration

DROP TABLE IF EXISTS exchange_rates;

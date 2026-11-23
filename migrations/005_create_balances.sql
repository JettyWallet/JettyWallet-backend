-- Up Migration

/*  Saldo DISPONIBLE de cada moneda dentro de una billetera.

    - Una fila por billetera y moneda (clave primaria compuesta).
    - El CHECK amount >= 0 es la última barrera contra saldos negativos: aunque
      el servicio valide, la base nunca acepta dejar un saldo en rojo.
    - El dinero guardado en metas de ahorro NO está acá: al aportar a una meta
      se descuenta de este saldo y se suma a savings_goals.amount.

    Para debitar sin condiciones de carrera, usar un UPDATE condicionado:
        UPDATE balances SET amount = amount - $monto
        WHERE wallet_id = $w AND currency_code = $c AND amount >= $monto
    Si no actualiza ninguna fila, el saldo es insuficiente. */

CREATE TABLE balances (
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
    amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (wallet_id, currency_code),

    CONSTRAINT balances_amount_non_negative
        CHECK (amount >= 0)
);

CREATE TRIGGER balances_set_updated_at
    BEFORE UPDATE ON balances
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS balances;

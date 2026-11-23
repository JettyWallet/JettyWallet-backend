-- Up Migration

/*  Metas de ahorro.

    Cada meta pertenece a una billetera y usa una sola moneda. El dinero
    aportado sale del saldo disponible (balances) y queda en amount; al
    retirarlo vuelve al saldo. Cada aporte o retiro se registra en
    transactions (tipos goal_deposit / goal_withdraw), así el historial de la
    billetera y el de la meta salen de la misma tabla.

    - target_amount y target_date son opcionales: una meta puede ser solo
      un "apartado" sin objetivo.
    - Las metas no se borran, se cierran (closed_at), para no perder el
      historial. Solo se puede cerrar una meta vacía.
    - No puede haber dos metas abiertas con el mismo nombre en una billetera. */

CREATE TABLE savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    name VARCHAR(100) NOT NULL,
    currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
    amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    target_amount NUMERIC(20, 2),
    target_date DATE,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT savings_goals_name_not_empty
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT savings_goals_amount_non_negative
        CHECK (amount >= 0),

    CONSTRAINT savings_goals_target_amount_positive
        CHECK (target_amount IS NULL OR target_amount > 0),

    CONSTRAINT savings_goals_closed_only_when_empty
        CHECK (closed_at IS NULL OR amount = 0)
);

CREATE INDEX idx_savings_goals_wallet
    ON savings_goals (wallet_id);

CREATE UNIQUE INDEX uq_savings_goals_open_name
    ON savings_goals (wallet_id, LOWER(name))
    WHERE closed_at IS NULL;

CREATE TRIGGER savings_goals_set_updated_at
    BEFORE UPDATE ON savings_goals
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS savings_goals;

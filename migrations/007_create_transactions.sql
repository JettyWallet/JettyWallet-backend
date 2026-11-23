-- Up Migration

/*  Historial de movimientos de cada billetera.

    Cada fila es un movimiento visto desde UNA billetera (wallet_id).
    Una transferencia genera dos filas: transfer_out en la billetera que envía
    y transfer_in en la que recibe, unidas por el mismo reference_id y cada una
    apuntando a la otra billetera en counterparty_wallet_id.

    Convención de montos:
    - amount_from: lo que sale de currency_from, comisión incluida.
    - amount_to:   lo que entra en currency_to.
    - fee_amount:  parte de amount_from que fue comisión (en currency_from).
    - rate:        1 currency_from = rate currency_to, aplicado sobre
                   (amount_from - fee_amount). Solo en intercambios.

    Forma de cada tipo (la garantiza transactions_shape_by_type):
    | type           | from         | rate | counterparty | savings_goal |
    |----------------|--------------|------|--------------|--------------|
    | deposit        | NULL         | NULL | NULL         | NULL         |
    | exchange       | distinta     | sí   | NULL         | NULL         |
    | transfer_out   | misma moneda | NULL | sí           | NULL         |
    | transfer_in    | misma moneda | NULL | sí           | NULL         |
    | goal_deposit   | misma moneda | NULL | NULL         | sí           |
    | goal_withdraw  | misma moneda | NULL | NULL         | sí           | */

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    type VARCHAR(20) NOT NULL,

    currency_from VARCHAR(3) REFERENCES currencies(code),
    amount_from NUMERIC(20, 2),
    currency_to VARCHAR(3) NOT NULL REFERENCES currencies(code),
    amount_to NUMERIC(20, 2) NOT NULL,
    rate NUMERIC(24, 12),

    fee_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    fee_currency VARCHAR(3) REFERENCES currencies(code),

    counterparty_wallet_id UUID REFERENCES wallets(id),
    savings_goal_id UUID REFERENCES savings_goals(id),
    reference_id UUID,

    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_type_valid
        CHECK (type IN (
            'deposit',
            'exchange',
            'transfer_out',
            'transfer_in',
            'goal_deposit',
            'goal_withdraw'
        )),

    CONSTRAINT transactions_amounts_positive
        CHECK (amount_to > 0 AND (amount_from IS NULL OR amount_from > 0)),

    CONSTRAINT transactions_rate_positive
        CHECK (rate IS NULL OR rate > 0),

    -- Sin comisión no hay moneda de comisión; con comisión, se cobra en la moneda de origen.
    CONSTRAINT transactions_fee_consistent
        CHECK (
            (fee_amount = 0 AND fee_currency IS NULL)
            OR (fee_amount > 0 AND fee_currency = currency_from AND fee_amount < amount_from)
        ),

    CONSTRAINT transactions_shape_by_type
        CHECK (
            (
                type = 'deposit'
                AND currency_from IS NULL
                AND amount_from IS NULL
                AND rate IS NULL
                AND counterparty_wallet_id IS NULL
                AND savings_goal_id IS NULL
                AND reference_id IS NULL
            )
            OR (
                type = 'exchange'
                AND currency_from IS NOT NULL
                AND amount_from IS NOT NULL
                AND currency_from <> currency_to
                AND rate IS NOT NULL
                AND counterparty_wallet_id IS NULL
                AND savings_goal_id IS NULL
            )
            OR (
                type IN ('transfer_out', 'transfer_in')
                AND currency_from = currency_to
                AND amount_from = amount_to + fee_amount
                AND rate IS NULL
                AND counterparty_wallet_id IS NOT NULL
                AND counterparty_wallet_id <> wallet_id
                AND savings_goal_id IS NULL
                AND reference_id IS NOT NULL
            )
            OR (
                type IN ('goal_deposit', 'goal_withdraw')
                AND currency_from = currency_to
                AND amount_from = amount_to
                AND fee_amount = 0
                AND rate IS NULL
                AND counterparty_wallet_id IS NULL
                AND savings_goal_id IS NOT NULL
            )
        ),

    -- Quien recibe una transferencia nunca paga comisión.
    CONSTRAINT transactions_transfer_in_without_fee
        CHECK (type <> 'transfer_in' OR fee_amount = 0)
);

-- Historial de una billetera, más recientes primero (con id para desempatar y paginar).
CREATE INDEX idx_transactions_wallet_created
    ON transactions (wallet_id, created_at DESC, id DESC);

-- Encontrar las dos filas de una misma transferencia.
CREATE INDEX idx_transactions_reference
    ON transactions (reference_id)
    WHERE reference_id IS NOT NULL;

-- Historial de una meta de ahorro.
CREATE INDEX idx_transactions_savings_goal
    ON transactions (savings_goal_id, created_at DESC)
    WHERE savings_goal_id IS NOT NULL;

-- Down Migration

DROP TABLE IF EXISTS transactions;

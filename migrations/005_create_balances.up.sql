/* Crea la tabla de de saldos. Se almacenará el saldo de cada moneda en la 
    billletera del usuario, y no se permite mas de un registro por moneda */ 

CREATE TABLE balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_id UUID NOT NULL REFERENCES wallets(id),

    currency_code VARCHAR(10) NOT NULL,

    amount DECIMAL(18, 2) NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_wallet_currency
        UNIQUE (wallet_id, currency_code),

    CONSTRAINT positive_balance
        CHECK (amount >= 0)
);
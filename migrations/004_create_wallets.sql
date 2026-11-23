-- Up Migration

/*  Billeteras. Cada usuario tiene exactamente una, creada en el registro.

    Además de agrupar los saldos, la fila de la billetera es lo que se bloquea
    (SELECT ... FOR UPDATE) en las operaciones que tocan dos billeteras, como
    las transferencias, siempre en el mismo orden para evitar deadlocks. */

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wallets_user_unique
        UNIQUE (user_id)
);

-- Down Migration

DROP TABLE IF EXISTS wallets;

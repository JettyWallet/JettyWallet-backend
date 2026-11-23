-- Up Migration

/*  Usuarios de Jetty.

    - email: se guarda siempre en minúsculas (lo garantiza un CHECK), así la
      restricción UNIQUE no deja pasar "Ana@mail.com" y "ana@mail.com".
    - account_number: número de cuenta público de 8 dígitos. Junto con el email,
      es lo que otro usuario usa para transferirle dinero. Se genera solo. */

-- Genera un número de cuenta de 8 dígitos que no esté en uso.
-- No es un secreto (se comparte para recibir transferencias), por eso alcanza con random().
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
AS $$
DECLARE
    candidate VARCHAR(8);
BEGIN
    LOOP
        candidate := (10000000 + FLOOR(RANDOM() * 90000000))::BIGINT::TEXT;
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM users WHERE account_number = candidate
        );
    END LOOP;

    RETURN candidate;
END;
$$;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    account_number VARCHAR(8) NOT NULL DEFAULT generate_account_number(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_name_not_empty
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT users_email_unique
        UNIQUE (email),

    CONSTRAINT users_email_lowercase
        CHECK (email = LOWER(email)),

    CONSTRAINT users_account_number_unique
        UNIQUE (account_number),

    CONSTRAINT users_account_number_format
        CHECK (account_number ~ '^[0-9]{8}$')
);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS generate_account_number();

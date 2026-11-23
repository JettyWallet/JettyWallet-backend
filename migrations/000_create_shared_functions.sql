-- Up Migration

/*  Funciones compartidas por varias tablas.

    set_updated_at(): se usa como trigger BEFORE UPDATE para mantener
    actualizada la columna updated_at sin depender de que cada consulta
    del backend se acuerde de hacerlo. */

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- Down Migration

DROP FUNCTION IF EXISTS set_updated_at();

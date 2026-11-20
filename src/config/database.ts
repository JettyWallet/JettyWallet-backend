import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.query("SELECT NOW()")
    .then((result) => {
        console.log("Conexión exitosa:", result.rows[0]);
    })
    .catch((error) => {
        console.error("Error de conexión:", error);
    });

export default pool;
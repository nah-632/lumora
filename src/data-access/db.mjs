import { Pool } from "pg";

let pool = null;

export function getPool() {
  if (pool) return pool;
  const required = ["PGDATABASE"];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`[boot] Missing required env var: ${key}`);
  }
  pool = new Pool({
    host: process.env.PGHOST || "/var/run/postgresql",
    database: process.env.PGDATABASE,
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

export async function q(text, params = []) {
  const { rows, rowCount } = await getPool().query(text, params);
  return { rows, rowCount };
}

export async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

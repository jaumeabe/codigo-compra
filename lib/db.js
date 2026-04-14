import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL no está definida');
}

export const sql = neon(process.env.DATABASE_URL);

let initialized = false;
export async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_codes (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      fecha DATE NOT NULL,
      granja TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      proveedor TEXT NOT NULL,
      importe NUMERIC(12,2) NOT NULL,
      comprador TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Columnas de albarán (una para legado, otra array para múltiples)
  await sql`
    ALTER TABLE purchase_codes
    ADD COLUMN IF NOT EXISTS albaran_url TEXT
  `;
  await sql`
    ALTER TABLE purchase_codes
    ADD COLUMN IF NOT EXISTS albaran_urls TEXT[] DEFAULT '{}'::TEXT[]
  `;
  initialized = true;
}

export function checkAdmin(req) {
  const pass = req.headers.get('x-admin-password');
  return pass && pass === process.env.ADMIN_PASSWORD;
}

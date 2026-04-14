import { NextResponse } from 'next/server';
import { sql, ensureSchema, checkAdmin } from '@/lib/db';

export const runtime = 'edge';

// POST = crear registro (público, para cualquier comprador)
export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { fecha, granja, descripcion, proveedor, importe, comprador, albaran_url } = body || {};

    if (!fecha || !granja || !descripcion || !proveedor || importe == null || !comprador) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }
    const importeNum = Number(importe);
    if (Number.isNaN(importeNum) || importeNum < 0) {
      return NextResponse.json({ error: 'Importe inválido' }, { status: 400 });
    }

    // Generar siguiente código C-XXXX de forma atómica
    const rows = await sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 3) AS INTEGER)), 0) AS max
      FROM purchase_codes
      WHERE codigo ~ '^C-[0-9]+$'
    `;
    const next = (rows[0].max || 0) + 1;
    const codigo = 'C-' + String(next).padStart(4, '0');

    const inserted = await sql`
      INSERT INTO purchase_codes (codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_url)
      VALUES (${codigo}, ${fecha}, ${granja}, ${descripcion}, ${proveedor}, ${importeNum}, ${comprador}, ${albaran_url || null})
      RETURNING codigo
    `;
    return NextResponse.json({ codigo: inserted[0].codigo });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// GET = listar registros (solo admin)
export async function GET(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_url, created_at
      FROM purchase_codes
      ORDER BY id DESC
    `;
    return NextResponse.json({ records: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// DELETE = borrar todo (solo admin)
export async function DELETE(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    await ensureSchema();
    await sql`TRUNCATE purchase_codes RESTART IDENTITY`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

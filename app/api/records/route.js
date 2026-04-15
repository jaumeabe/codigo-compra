import { NextResponse } from 'next/server';
import { sql, ensureSchema, checkAdmin } from '@/lib/db';
import { syncExcelToOneDrive } from '@/lib/excel';

export const runtime = 'nodejs';

// POST = crear registro (público, para cualquier comprador)
export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { fecha, granja, descripcion, proveedor, importe, comprador, albaran_urls } = body || {};
    const urls = Array.isArray(albaran_urls) ? albaran_urls.filter(Boolean) : [];

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
      INSERT INTO purchase_codes (codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_urls)
      VALUES (${codigo}, ${fecha}, ${granja}, ${descripcion}, ${proveedor}, ${importeNum}, ${comprador}, ${urls})
      RETURNING codigo
    `;

    // Auto-sync del Excel a OneDrive (no romper la respuesta si falla)
    let syncError = null;
    try {
      await syncExcelToOneDrive();
    } catch (syncErr) {
      console.error('syncExcelToOneDrive falló:', syncErr);
      syncError = syncErr.message || String(syncErr);
    }

    return NextResponse.json({ codigo: inserted[0].codigo, syncError });
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
      SELECT codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_url, albaran_urls, created_at
      FROM purchase_codes
      ORDER BY id DESC
    `;
    // Merge del campo legado con el array nuevo
    const records = rows.map(r => {
      const list = Array.isArray(r.albaran_urls) ? r.albaran_urls.slice() : [];
      if (r.albaran_url && !list.includes(r.albaran_url)) list.unshift(r.albaran_url);
      return { ...r, albaran_urls: list };
    });
    return NextResponse.json({ records });
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

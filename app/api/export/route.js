import { sql, ensureSchema, checkAdmin } from '@/lib/db';
import * as XLSX from 'xlsx';

// Node runtime (xlsx necesita Buffer)
export const runtime = 'nodejs';

export async function GET(req) {
  if (!checkAdmin(req)) {
    return new Response('No autorizado', { status: 401 });
  }
  await ensureSchema();
  const rows = await sql`
    SELECT codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_url, albaran_urls, created_at
    FROM purchase_codes
    ORDER BY id ASC
  `;

  // Normalizar lista de albaranes
  const normalized = rows.map(r => {
    const list = Array.isArray(r.albaran_urls) ? r.albaran_urls.slice() : [];
    if (r.albaran_url && !list.includes(r.albaran_url)) list.unshift(r.albaran_url);
    return { ...r, albaranes: list };
  });

  const data = normalized.map(r => ({
    'Código': r.codigo,
    'Fecha': r.fecha,
    'Granja': r.granja,
    'Descripción': r.descripcion,
    'Proveedor': r.proveedor,
    'Importe (€)': Number(r.importe),
    'Comprador': r.comprador,
    'Nº albaranes': r.albaranes.length,
    'Albaranes': r.albaranes.join('\n'),
    'Creado': new Date(r.created_at).toLocaleString('es-ES')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    {wch:10},{wch:12},{wch:22},{wch:38},{wch:22},{wch:12},{wch:20},{wch:13},{wch:50},{wch:20}
  ];

  // Primera URL de cada fila como hipervínculo clicable (columna "Albaranes")
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    const row = normalized[R - 1];
    if (!row || row.albaranes.length === 0) continue;
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: 8 })];
    if (cell) {
      cell.l = { Target: row.albaranes[0], Tooltip: 'Abrir primer albarán' };
      cell.s = { alignment: { wrapText: true, vertical: 'top' } };
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Códigos de compra');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const today = new Date().toISOString().slice(0,10);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="codigos_compra_${today}.xlsx"`
    }
  });
}

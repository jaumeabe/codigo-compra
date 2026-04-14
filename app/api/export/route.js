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
    SELECT codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_url, created_at
    FROM purchase_codes
    ORDER BY id ASC
  `;

  const data = rows.map(r => ({
    'Código': r.codigo,
    'Fecha': r.fecha,
    'Granja': r.granja,
    'Descripción': r.descripcion,
    'Proveedor': r.proveedor,
    'Importe (€)': Number(r.importe),
    'Comprador': r.comprador,
    'Albarán': r.albaran_url || '',
    'Creado': new Date(r.created_at).toLocaleString('es-ES')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    {wch:10},{wch:12},{wch:22},{wch:38},{wch:22},{wch:12},{wch:20},{wch:40},{wch:20}
  ];

  // Convertir columna Albarán en hipervínculos clicables
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: 7 })];
    if (cell && cell.v) {
      cell.l = { Target: cell.v, Tooltip: 'Abrir albarán' };
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

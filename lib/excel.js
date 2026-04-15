import * as XLSX from 'xlsx';
import { sql, ensureSchema } from './db';
import { uploadToOneDrive } from './graph';

export async function generateExcelBuffer() {
  await ensureSchema();
  const rows = await sql`
    SELECT codigo, fecha, granja, descripcion, proveedor, importe, comprador, albaran_url, albaran_urls, created_at
    FROM purchase_codes
    ORDER BY id ASC
  `;

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
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      const row = normalized[R - 1];
      if (!row || row.albaranes.length === 0) continue;
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 8 })];
      if (cell) cell.l = { Target: row.albaranes[0], Tooltip: 'Abrir primer albarán' };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Códigos de compra');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export async function syncExcelToOneDrive() {
  const buffer = await generateExcelBuffer();
  return uploadToOneDrive({
    filename: 'codigos_compra.xlsx',
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    conflictBehavior: 'replace'
  });
}

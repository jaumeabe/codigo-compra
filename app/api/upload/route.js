import { NextResponse } from 'next/server';
import { uploadToOneDrive } from '@/lib/graph';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function isAllowed(type) {
  if (!type) return true; // algunos móviles no mandan MIME
  return type.startsWith('image/') || type === 'application/pdf';
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 });
    }
    if (!isAllowed(file.type)) {
      return NextResponse.json({ error: `Tipo no permitido: ${file.type}` }, { status: 400 });
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (file.name || 'albaran').replace(/[^\w.\-]/g, '_');
    const filename = `${ts}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadToOneDrive({
      filename,
      buffer,
      contentType: file.type
    });

    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Error al subir archivo' }, { status: 500 });
  }
}

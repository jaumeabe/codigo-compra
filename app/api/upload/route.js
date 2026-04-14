import { NextResponse } from 'next/server';
import { uploadToOneDrive } from '@/lib/graph';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
const MAX_FILES = 10;

function isAllowed(type) {
  if (!type) return true;
  return type.startsWith('image/') || type === 'application/pdf';
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const files = form.getAll('file').filter(f => typeof f !== 'string');

    if (files.length === 0) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Máximo ${MAX_FILES} archivos por envío` }, { status: 400 });
    }

    const urls = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `"${file.name}" supera 10 MB` }, { status: 400 });
      }
      if (!isAllowed(file.type)) {
        return NextResponse.json({ error: `Tipo no permitido: ${file.type}` }, { status: 400 });
      }
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = (file.name || 'albaran').replace(/[^\w.\-]/g, '_');
      const filename = `${ts}_${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadToOneDrive({
        filename,
        buffer,
        contentType: file.type
      });
      urls.push(result.url);
    }

    return NextResponse.json({ urls });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Error al subir archivo' }, { status: 500 });
  }
}

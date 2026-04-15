// Helper para subir archivos a OneDrive for Business / SharePoint vía Microsoft Graph.
// Usa flujo client_credentials (app-only), requiere permiso Files.ReadWrite.All
// con consentimiento de administrador.

async function getAccessToken() {
  const { GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET } = process.env;
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    throw new Error('Faltan env vars GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET');
  }
  const body = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }
  );
  if (!r.ok) {
    throw new Error('Error token Graph: ' + (await r.text()));
  }
  const data = await r.json();
  return data.access_token;
}

function encodePath(folder, filename) {
  return [folder, filename]
    .filter(Boolean)
    .map(s => encodeURIComponent(s))
    .join('/');
}

export async function uploadToOneDrive({ filename, buffer, contentType, conflictBehavior = 'rename' }) {
  const { GRAPH_USER, GRAPH_FOLDER } = process.env;
  if (!GRAPH_USER) {
    throw new Error('Falta GRAPH_USER (email del propietario del OneDrive)');
  }
  const folder = GRAPH_FOLDER || 'Codigos Compra';
  const token = await getAccessToken();
  const user = encodeURIComponent(GRAPH_USER);
  const pathSeg = encodePath(folder, filename);

  // Crear upload session (robusto para cualquier tamaño)
  const sessionRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${user}/drive/root:/${pathSeg}:/createUploadSession`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': conflictBehavior,
          name: filename
        }
      })
    }
  );
  if (!sessionRes.ok) {
    throw new Error('Error creando upload session: ' + (await sessionRes.text()));
  }
  const { uploadUrl } = await sessionRes.json();

  // Subida en un único PUT (válido hasta 60 MB, sobra para nuestros 10 MB)
  const size = buffer.length;
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
      'Content-Type': contentType || 'application/octet-stream'
    },
    body: buffer
  });
  if (!uploadRes.ok) {
    throw new Error('Error subiendo a OneDrive: ' + (await uploadRes.text()));
  }
  const item = await uploadRes.json();
  return {
    url: item.webUrl,
    id: item.id,
    name: item.name
  };
}

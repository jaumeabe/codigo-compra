'use client';
import { useEffect, useState } from 'react';

export default function Page() {
  const [view, setView] = useState('form'); // form | login | admin
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    fecha: today, granja: '', descripcion: '', proveedor: '', importe: '', comprador: ''
  });
  const [albaranFile, setAlbaranFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [error, setError] = useState(null);

  const [adminPass, setAdminPass] = useState('');
  const [savedPass, setSavedPass] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [records, setRecords] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    const p = sessionStorage.getItem('admin_pass');
    if (p) setSavedPass(p);
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submitForm(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedCode(null);
    try {
      let albaran_url = null;
      if (albaranFile) {
        const fd = new FormData();
        fd.append('file', albaranFile);
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || 'Error subiendo albarán');
        albaran_url = upData.url;
      }
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, albaran_url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setGeneratedCode(data.codigo);
      setForm({ fecha: today, granja: '', descripcion: '', proveedor: '', importe: '', comprador: '' });
      setAlbaranFile(null);
      const fi = document.getElementById('albaranInput');
      if (fi) fi.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function doLogin() {
    setLoginError(false);
    const res = await fetch('/api/records', { headers: { 'x-admin-password': adminPass } });
    if (res.ok) {
      sessionStorage.setItem('admin_pass', adminPass);
      setSavedPass(adminPass);
      const data = await res.json();
      setRecords(data.records);
      setView('admin');
    } else {
      setLoginError(true);
    }
  }

  async function refreshRecords() {
    setAdminLoading(true);
    const res = await fetch('/api/records', { headers: { 'x-admin-password': savedPass } });
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records);
    }
    setAdminLoading(false);
  }

  async function downloadExcel() {
    const res = await fetch('/api/export', { headers: { 'x-admin-password': savedPass } });
    if (!res.ok) { alert('Error al descargar'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigos_compra_${today}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearAll() {
    if (!confirm('¿Seguro que quieres borrar TODOS los registros? Esta acción no se puede deshacer.')) return;
    const res = await fetch('/api/records', {
      method: 'DELETE',
      headers: { 'x-admin-password': savedPass }
    });
    if (res.ok) refreshRecords();
  }

  function logout() {
    sessionStorage.removeItem('admin_pass');
    setSavedPass('');
    setAdminPass('');
    setView('form');
  }

  return (
    <div className="container">
      <header>
        <h1>Gestión de Códigos de Compra</h1>
        {view === 'form' && (
          <button className="link" onClick={() => setView('login')}>Administrador</button>
        )}
        {view === 'admin' && (
          <button className="link" onClick={logout}>Salir</button>
        )}
      </header>

      {view === 'form' && (
        <div className="card">
          <form onSubmit={submitForm}>
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => update('fecha', e.target.value)} required />

            <label>Nombre de la granja</label>
            <input type="text" value={form.granja} onChange={e => update('granja', e.target.value)} required placeholder="Ej: Granja Can Pere" />

            <label>Descripción</label>
            <textarea value={form.descripcion} onChange={e => update('descripcion', e.target.value)} required placeholder="Descripción del material o servicio" />

            <label>Proveedor</label>
            <input type="text" value={form.proveedor} onChange={e => update('proveedor', e.target.value)} required placeholder="Ej: Ferretería Martí" />

            <label>Importe (€)</label>
            <input type="number" step="0.01" min="0" value={form.importe} onChange={e => update('importe', e.target.value)} required placeholder="0.00" />

            <label>Comprador</label>
            <input type="text" value={form.comprador} onChange={e => update('comprador', e.target.value)} required placeholder="Nombre del comprador" />

            <label>Foto del albarán (opcional)</label>
            <input
              id="albaranInput"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={e => setAlbaranFile(e.target.files?.[0] || null)}
            />
            {albaranFile && (
              <div style={{ fontSize: 12, color: '#555', marginTop: -8, marginBottom: 14 }}>
                {albaranFile.name} ({(albaranFile.size / 1024).toFixed(0)} KB)
              </div>
            )}

            <button type="submit" disabled={loading}>
              {loading ? 'Generando...' : 'Generar código de autorización'}
            </button>
          </form>

          {generatedCode && (
            <div className="result">
              <div>Código de autorización generado:</div>
              <div className="code">{generatedCode}</div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#555' }}>Guardado correctamente.</div>
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </div>
      )}

      {view === 'login' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Acceso administrador</h2>
          <label>Contraseña</label>
          <input
            type="password" value={adminPass}
            onChange={e => setAdminPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
            placeholder="Introduce la contraseña"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={doLogin}>Entrar</button>
            <button className="secondary" onClick={() => setView('form')}>Volver</button>
          </div>
          {loginError && <div className="error">Contraseña incorrecta</div>}
        </div>
      )}

      {view === 'admin' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Panel de administración</h2>
            <button className="secondary" onClick={() => setView('form')}>Nuevo registro</button>
          </div>
          <div className="toolbar">
            <button onClick={downloadExcel}>Descargar Excel</button>
            <button className="secondary" onClick={refreshRecords} disabled={adminLoading}>
              {adminLoading ? 'Actualizando...' : 'Refrescar'}
            </button>
            <button className="danger" onClick={clearAll}>Borrar todo</button>
          </div>
          {records.length === 0 ? (
            <div className="empty">No hay registros todavía.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th><th>Fecha</th><th>Granja</th><th>Descripción</th>
                    <th>Proveedor</th><th>Importe</th><th>Comprador</th><th>Albarán</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.codigo}>
                      <td><strong>{r.codigo}</strong></td>
                      <td>{r.fecha}</td>
                      <td>{r.granja}</td>
                      <td>{r.descripcion}</td>
                      <td>{r.proveedor}</td>
                      <td>{Number(r.importe).toFixed(2)} €</td>
                      <td>{r.comprador}</td>
                      <td>
                        {r.albaran_url ? (
                          <a href={r.albaran_url} target="_blank" rel="noreferrer">Ver</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

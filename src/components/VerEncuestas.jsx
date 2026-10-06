import { useCallback, useEffect, useState } from 'react';
import api, { descargarArchivo, mensajeError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Ver respuestas de la encuesta (admin y moderador).
 * Solo admin puede exportar CSV.
 * Vista de gráficas + tabla por usuario.
 */
export default function VerEncuestas() {
  const { usuario } = useAuth();
  const { notificar } = useToast();
  const [datos, setDatos] = useState({ preguntas: [], resumen: [], usuarios: [] });
  const [vista, setVista] = useState('graficas'); // 'graficas' | 'tabla'
  const [soloCompletadas, setSoloCompletadas] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/encuesta');
      setDatos(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const usuarios = datos.usuarios.filter((u) => (soloCompletadas ? u.completada : true));
  const completadas = datos.usuarios.filter((u) => u.completada).length;

  const exportar = async () => {
    setExportando(true);
    try {
      await descargarArchivo('/encuesta/exportar', 'encuesta-fiesta.csv');
      notificar('CSV exportado.', 'exito');
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo exportar.'), 'error');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`tab ${vista === 'graficas' ? 'tab-activa' : ''}`} onClick={() => setVista('graficas')}>
            📊 Gráficas
          </button>
          <button type="button" className={`tab ${vista === 'tabla' ? 'tab-activa' : ''}`} onClick={() => setVista('tabla')}>
            🗂️ Por usuario
          </button>
        </div>

        {usuario?.rol === 'admin' && (
          <button type="button" className="btn-fantasma" onClick={exportar} disabled={exportando}>
            {exportando ? 'Exportando…' : '⬇️ Exportar CSV'}
          </button>
        )}
      </div>

      {vista === 'graficas' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {cargando ? (
            <p className="panela p-8 text-center text-sm text-slate-500 md:col-span-2">Cargando gráficas…</p>
          ) : (datos.resumen || []).length === 0 ? (
            <p className="panela p-8 text-center text-sm text-slate-500 md:col-span-2">
              Aún no hay preguntas ni respuestas para graficar. 📊
            </p>
          ) : (
            (datos.resumen || []).map((r) => {
              const max = Math.max(1, ...r.opciones.map((o) => o.cantidad));
              return (
                <section key={r.pregunta_id} className="panela p-4">
                  <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{r.texto}</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {r.total} respuesta(s)
                    </span>
                  </header>
                  {r.tipo === 'texto' ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Pregunta abierta: revisa las respuestas en la vista <strong className="text-slate-200">Por usuario</strong> o en el CSV.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {r.opciones.map((o) => (
                        <div key={o.texto}>
                          <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                            <span className="truncate font-semibold text-slate-200">{o.texto}</span>
                            <span className="shrink-0 tabular-nums text-amber-300">
                              {o.cantidad} · {r.total ? Math.round((o.cantidad / r.total) * 100) : 0}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-all"
                              style={{ width: `${Math.round((o.cantidad / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      ) : (
      <>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`tab ${soloCompletadas ? 'tab-activa' : ''}`} onClick={() => setSoloCompletadas(true)}>
            ✅ Completadas ({completadas})
          </button>
          <button type="button" className={`tab ${!soloCompletadas ? 'tab-activa' : ''}`} onClick={() => setSoloCompletadas(false)}>
            👥 Todos ({datos.usuarios.length})
          </button>
        </div>
        <div className="panela hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr>
              <th className="th-tabla sticky left-0 z-10 bg-slate-950/80">Usuario</th>
              <th className="th-tabla">Estado</th>
              <th className="th-tabla">Acompañante</th>
              {datos.preguntas.map((p) => (
                <th key={p.id} className="th-tabla min-w-[160px] max-w-[240px]">
                  {p.texto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {cargando ? (
              <tr>
                <td className="td-tabla py-8 text-center text-slate-500" colSpan={4 + datos.preguntas.length}>
                  Cargando respuestas…
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td className="td-tabla py-8 text-center text-slate-500" colSpan={4 + datos.preguntas.length}>
                  Aún no hay respuestas de encuesta.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="td-tabla sticky left-0 bg-slate-950/70">
                    <p className="font-semibold text-white">{u.nombre}</p>
                    <p className="text-xs text-slate-500">C.C. {u.cedula}</p>
                  </td>
                  <td className="td-tabla">
                    {u.completada ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        COMPLETADA
                      </span>
                    ) : (
                      <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        PENDIENTE
                      </span>
                    )}
                  </td>
                  <td className="td-tabla whitespace-nowrap">
                    {Number(u.n_acompanantes) > 0 ? (
                      <span className="text-xs font-semibold text-sky-300">
                        👥 {u.n_acompanantes}/4
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  {datos.preguntas.map((p) => (
                    <td key={p.id} className="td-tabla max-w-[240px] break-words text-slate-300">
                      {u.respuestas?.[p.id] || <span className="text-slate-600">—</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        {/* Tarjetas por usuario (solo teléfono) */}
        <div className="space-y-3 md:hidden">
          {cargando ? (
            <p className="panela p-6 text-center text-sm text-slate-500">Cargando respuestas…</p>
          ) : usuarios.length === 0 ? (
            <p className="panela p-6 text-center text-sm text-slate-500">Aún no hay respuestas de encuesta.</p>
          ) : (
            usuarios.map((u) => (
              <article key={u.id} className="panela space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{u.nombre}</p>
                    <p className="text-xs text-slate-500">C.C. {u.cedula}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {u.completada ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        COMPLETADA
                      </span>
                    ) : (
                      <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        PENDIENTE
                      </span>
                    )}
                    {Number(u.n_acompanantes) > 0 && (
                      <span className="text-[11px] font-semibold text-sky-300">👥 {u.n_acompanantes}/4</span>
                    )}
                  </div>
                </div>
                <dl className="space-y-1.5 border-t border-white/10 pt-2">
                  {datos.preguntas.map((p) => (
                    <div key={p.id}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{p.texto}</dt>
                      <dd className="break-words text-sm text-slate-200">{u.respuestas?.[p.id] || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))
          )}
        </div>
      </>
      )}
    </div>
  );
}

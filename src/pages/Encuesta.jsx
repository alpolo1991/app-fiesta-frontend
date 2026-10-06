import { useEffect, useMemo, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { fechaLegible } from '../utils';

/** Encuesta dinámica: tipos multiple (con límite), unica, texto, si_no. */

/**
 * Encuesta DINÁMICA: se genera a partir de /api/preguntas.
 * Tipos: multiple (con límite), unica, texto, si_no.
 * Los acompañantes se gestionan en el menú Acompañantes.
 */
export default function Encuesta() {
  const { notificar } = useToast();
  const [preguntas, setPreguntas] = useState([]);
  const [mia, setMia] = useState({ completada: false, respuestas: [] });
  const [respuestas, setRespuestas] = useState({}); // {pregunta_id: valor}
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/preguntas'), api.get('/encuesta/mia')])
      .then(([p, m]) => {
        setPreguntas(p.data);
        setMia(m.data);
      })
      .catch((e) => notificar(mensajeError(e, 'No se pudo cargar la encuesta.'), 'error'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opcionesDe = (p) => p.opciones?.map((o) => o.texto) || [];

  // ----Selección múltiple (con límite)----
  const alternarMultiple = (p, texto) => {
    const max = Number(p.max_selecciones) || 0;
    setRespuestas((prev) => {
      const actual = Array.isArray(prev[p.id]) ? prev[p.id] : [];
      let nueva;
      if (actual.includes(texto)) {
        nueva = actual.filter((t) => t !== texto);
      } else {
        if (max > 0 && actual.length >= max) {
          notificar(`Máximo ${max} selecciones para "${p.texto}".`, 'error');
          return prev;
        }
        nueva = [...actual, texto];
      }
      return { ...prev, [p.id]: nueva };
    });
  };

  const sinResponder = useMemo(
    () =>
      preguntas.filter((p) => {
        if (!p.es_obligatoria) return false;
        const v = respuestas[p.id];
        if (Array.isArray(v)) return v.length === 0;
        return v === undefined || v === null || String(v).trim() === '';
      }),
    [preguntas, respuestas]
  );

  const enviar = async (e) => {
    e.preventDefault();
    if (sinResponder.length) {
      notificar(`Faltan preguntas obligatorias: ${sinResponder.map((p) => `«${p.texto}»`).join(', ')}`, 'error');
      return;
    }

    const lista = preguntas
      .filter((p) => respuestas[p.id] !== undefined)
      .map((p) => ({ pregunta_id: p.id, respuesta: respuestas[p.id] }));

    setEnviando(true);
    try {
      const { data } = await api.post('/encuesta', { respuestas: lista });
      notificar(data.mensaje, 'exito');
      const m = await api.get('/encuesta/mia');
      setMia(m.data);
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo enviar la encuesta.'), 'error');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
      </div>
    );
  }

  // ---------- Ya respondida: resumen de solo lectura ----------
  if (mia.completada) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="text-center">
          <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-500 text-3xl">
            🎉
          </span>
          <h1 className="font-display text-2xl font-extrabold text-white">¡Gracias por responder!</h1>
          <p className="mt-1 text-sm text-slate-400">Encuesta completada el {fechaLegible(mia.completada_en)}</p>
        </header>

        <section className="panela divide-y divide-white/10 p-5">
          {mia.respuestas.map((r) => (
            <div key={r.pregunta_id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{r.pregunta_texto}</p>
              <p className="mt-1 text-sm font-medium text-slate-200">{r.respuesta || '—'}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  // ---------- Formulario ----------
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Encuesta</p>
        <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Cuéntanos tus preferencias</h1>
        <p className="mt-1 text-sm text-slate-400">
          Se responde <strong className="text-slate-200">una sola vez</strong>. Marca tus respuestas y envía.
        </p>
      </header>

      {preguntas.length === 0 ? (
        <div className="panela p-8 text-center text-sm text-slate-400">
          La encuesta aún no tiene preguntas activas. ¡Vuelve pronto! 🎊
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-4">
          {preguntas.map((p, idx) => (
            <fieldset key={p.id} className="panela p-5">
              <legend className="sr-only">{p.texto}</legend>
              <div className="mb-3 flex items-start justify-between gap-3">
                <label className="font-display text-base font-bold text-white">
                  <span className="mr-2 text-amber-400">{idx + 1}.</span>
                  {p.texto}
                  {p.es_obligatoria ? <span className="ml-1 text-rose-400">*</span> : <span className="ml-2 text-xs font-medium text-slate-500">(opcional)</span>}
                </label>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {p.tipo === 'multiple' ? 'Selección múltiple' : p.tipo === 'unica' ? 'Única' : p.tipo === 'si_no' ? 'Sí / No' : 'Texto'}
                </span>
              </div>

              {/* ---------- Múltiple ---------- */}
              {p.tipo === 'multiple' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {opcionesDe(p).map((op) => {
                      const seleccionadas = Array.isArray(respuestas[p.id]) ? respuestas[p.id] : [];
                      const activa = seleccionadas.includes(op);
                      const llegoAlMax = Number(p.max_selecciones) > 0 && seleccionadas.length >= Number(p.max_selecciones);
                      return (
                        <button
                          key={op}
                          type="button"
                          onClick={() => alternarMultiple(p, op)}
                          disabled={!activa && llegoAlMax}
                          className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            activa
                              ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                              : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30'
                          }`}
                        >
                          {activa ? '✓ ' : ''}
                          {op}
                        </button>
                      );
                    })}
                  </div>
                  {Number(p.max_selecciones) > 0 && (
                    <p className="text-xs text-slate-500">
                      Máximo {p.max_selecciones} · seleccionadas:{' '}
                      <strong className="text-amber-300">{Array.isArray(respuestas[p.id]) ? respuestas[p.id].length : 0}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* ---------- Única ---------- */}
              {p.tipo === 'unica' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {opcionesDe(p).map((op) => (
                    <label
                      key={op}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                        respuestas[p.id] === op
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`p-${p.id}`}
                        className="accent-amber-400"
                        checked={respuestas[p.id] === op}
                        onChange={() => setRespuestas((r) => ({ ...r, [p.id]: op }))}
                      />
                      {op}
                    </label>
                  ))}
                </div>
              )}

              {/* ---------- Sí / No ---------- */}
              {p.tipo === 'si_no' && (
                <div className="flex gap-3">
                  {(opcionesDe(p).length ? opcionesDe(p) : ['Sí', 'No']).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setRespuestas((r) => ({ ...r, [p.id]: op }))}
                      className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold transition ${
                        respuestas[p.id] === op
                          ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              )}

              {/* ---------- Texto ---------- */}
              {p.tipo === 'texto' && (
                <textarea
                  className="campo min-h-24 resize-y"
                  placeholder="Escribe aquí…"
                  value={respuestas[p.id] || ''}
                  onChange={(e) => setRespuestas((r) => ({ ...r, [p.id]: e.target.value }))}
                  maxLength={1000}
                />
              )}
            </fieldset>
          ))}

          <div className="panela flex flex-col items-center gap-3 p-5 sm:flex-row sm:justify-between">
            <p className="text-xs text-slate-400">
              {sinResponder.length > 0 ? (
                <span className="text-rose-300">⏳ Te faltan {sinResponder.length} pregunta(s) obligatoria(s).</span>
              ) : (
                <span className="text-emerald-300">✅ Listo para enviar.</span>
              )}
            </p>
            <button type="submit" className="btn-oro w-full sm:w-auto" disabled={enviando}>
              {enviando ? 'Enviando…' : '🚀 Enviar respuestas'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

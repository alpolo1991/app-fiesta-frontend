import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

const TIPOS = [
  { v: 'multiple', t: 'Selección múltiple' },
  { v: 'unica', t: 'Selección única' },
  { v: 'texto', t: 'Texto libre' },
  { v: 'si_no', t: 'Sí / No' },
];

/**
 * CRUD dinámico de preguntas de la encuesta (SOLO admin).
 * Crear, editar, activar/desactivar, eliminar y gestionar opciones.
 */
export default function PreguntasCRUD() {
  const { notificar } = useToast();
  const [preguntas, setPreguntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editor, setEditor] = useState(null); // null | 'nueva' | pregunta
  const [opcionesDraft, setOpcionesDraft] = useState({}); // {pregunta_id: texto}
  const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState({ texto: '', tipo: 'unica', max_selecciones: 0, es_obligatoria: 1, orden: 0, opciones: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/preguntas', { params: { todas: 1 } });
      setPreguntas(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNuevo = () => {
    setF({ texto: '', tipo: 'unica', max_selecciones: 0, es_obligatoria: 1, orden: preguntas.length + 1, opciones: '' });
    setEditor('nueva');
  };

  const abrirEditar = (p) => {
    setF({
      texto: p.texto,
      tipo: p.tipo,
      max_selecciones: p.max_selecciones,
      es_obligatoria: p.es_obligatoria,
      orden: p.orden,
      opciones: '',
    });
    setEditor(p);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try {
      const base = {
        texto: f.texto,
        tipo: f.tipo,
        max_selecciones: Number(f.max_selecciones) || 0,
        es_obligatoria: f.es_obligatoria ? 1 : 0,
        orden: Number(f.orden) || 0,
      };
      if (editor === 'nueva') {
        const opciones = f.opciones
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const { data } = await api.post('/preguntas', { ...base, opciones });
        notificar(data.mensaje, 'exito');
      } else {
        const { data } = await api.put(`/preguntas/${editor.id}`, base);
        notificar(data.mensaje, 'exito');
      }
      setEditor(null);
      await cargar();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const alternarActiva = async (p) => {
    try {
      const { data } = await api.put(`/preguntas/${p.id}/activa`, { activa: p.activa ? 0 : 1 });
      notificar(data.mensaje, 'exito');
      setPreguntas((prev) => prev.map((x) => (x.id === p.id ? { ...x, activa: data.activa } : x)));
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  };

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar la pregunta "${p.texto}"? También se borrarán sus respuestas.`)) return;
    try {
      const { data } = await api.delete(`/preguntas/${p.id}`);
      notificar(data.mensaje, 'exito');
      setPreguntas((prev) => prev.filter((x) => x.id !== p.id));
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  };

  const agregarOpcion = async (e, p) => {
    e.preventDefault();
    const texto = (opcionesDraft[p.id] || '').trim();
    if (!texto) return;
    if (texto.length > 80) return notificar('La opción no puede superar 80 caracteres.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.post(`/preguntas/${p.id}/opciones`, { texto });
      notificar(data.mensaje, 'exito');
      setOpcionesDraft((prev) => ({ ...prev, [p.id]: '' }));
      setPreguntas((prev) => prev.map((x) => (x.id === p.id ? { ...x, opciones: [...x.opciones, data.opcion] } : x)));
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const borrarOpcion = async (p, o) => {
    try {
      await api.delete(`/opciones/${o.id}`);
      notificar('Opción eliminada.', 'exito');
      setPreguntas((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, opciones: x.opciones.filter((y) => y.id !== o.id) } : x))
      );
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          La encuesta se genera a partir de estas preguntas. Puedes activarlas o desactivarlas en cualquier momento.
        </p>
        <button type="button" className="btn-oro" onClick={abrirNuevo}>
          ＋ Nueva pregunta
        </button>
      </div>

      {cargando ? (
        <div className="panela p-8 text-center text-sm text-slate-500">Cargando preguntas…</div>
      ) : preguntas.length === 0 ? (
        <div className="panela p-8 text-center text-sm text-slate-500">No hay preguntas creadas.</div>
      ) : (
        <div className="space-y-3">
          {preguntas.map((p, i) => (
            <article key={p.id} className={`panela p-4 ${!p.activa ? 'opacity-60' : ''}`}>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-amber-400">{i + 1}.</span>
                    <h3 className="font-display text-base font-bold text-white">{p.texto}</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {TIPOS.find((t) => t.v === p.tipo)?.t || p.tipo}
                    </span>
                    {p.es_obligatoria ? (
                      <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        OBLIGATORIA
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        OPCIONAL
                      </span>
                    )}
                    {!p.activa && (
                      <span className="rounded-full border border-slate-400/30 bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        INACTIVA
                      </span>
                    )}
                    {p.tipo === 'multiple' && p.max_selecciones > 0 && (
                      <span className="text-[11px] text-slate-500">máx. {p.max_selecciones}</span>
                    )}
                  </div>

                  {/* Opciones */}
                  {(p.opciones || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.opciones.map((o) => (
                        <span
                          key={o.id}
                          className="group inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                        >
                          {o.texto}
                          <button
                            type="button"
                            onClick={() => borrarOpcion(p, o)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center text-slate-500 transition hover:text-rose-400"
                            title="Eliminar opción"
                            aria-label={`Eliminar opción ${o.texto}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Agregar opción */}
                  {['multiple', 'unica', 'si_no'].includes(p.tipo) && (
                    <form onSubmit={(e) => agregarOpcion(e, p)} className="mt-2 flex max-w-sm gap-2">
                      <input
                        className="campo !py-1.5 text-xs"
                        placeholder="Nueva opción…"
                        maxLength={80}
                        value={opcionesDraft[p.id] || ''}
                        onChange={(e) => setOpcionesDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        aria-label={`Nueva opción para ${p.texto}`}
                      />
                      <button type="submit" className="btn-mini" disabled={ocupado}>
                        Añadir
                      </button>
                    </form>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                  <button type="button" className="btn-mini" onClick={() => alternarActiva(p)}>
                    {p.activa ? '⏸ Desactivar' : '▶ Activar'}
                  </button>
                  <button type="button" className="btn-mini" onClick={() => abrirEditar(p)} aria-label={`Editar pregunta ${p.texto}`}>
                    ✏️ Editar
                  </button>
                  <button type="button" className="btn-mini !text-rose-300" onClick={() => eliminar(p)} aria-label={`Eliminar pregunta ${p.texto}`}>
                    🗑
                  </button>
                </div>
              </header>
            </article>
          ))}
        </div>
      )}

      {/* Modal crear / editar pregunta */}
      <Modal
        abierto={!!editor}
        titulo={editor === 'nueva' ? 'Nueva pregunta' : 'Editar pregunta'}
        onCerrar={() => setEditor(null)}
      >
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className="etiqueta">Texto de la pregunta</label>
            <input
              className="campo"
              value={f.texto}
              onChange={(e) => setF((v) => ({ ...v, texto: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Tipo</label>
              <select className="campo" value={f.tipo} onChange={(e) => setF((v) => ({ ...v, tipo: e.target.value }))}>
                {TIPOS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiqueta">Orden</label>
              <input
                type="number"
                className="campo"
                min="0"
                value={f.orden}
                onChange={(e) => setF((v) => ({ ...v, orden: e.target.value }))}
              />
            </div>
          </div>

          {f.tipo === 'multiple' && (
            <div>
              <label className="etiqueta">Máximo de selecciones (0 = sin límite)</label>
              <input
                type="number"
                className="campo"
                min="0"
                value={f.max_selecciones}
                onChange={(e) => setF((v) => ({ ...v, max_selecciones: e.target.value }))}
              />
            </div>
          )}

          {editor === 'nueva' && (
            <div>
              <label className="etiqueta">Opciones iniciales (separadas por coma)</label>
              <input
                className="campo"
                placeholder="Opción 1, Opción 2, Opción 3"
                value={f.opciones}
                onChange={(e) => setF((v) => ({ ...v, opciones: e.target.value }))}
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-amber-400"
              checked={!!f.es_obligatoria}
              onChange={(e) => setF((v) => ({ ...v, es_obligatoria: e.target.checked ? 1 : 0 }))}
            />
            Pregunta obligatoria
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-fantasma" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar pregunta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

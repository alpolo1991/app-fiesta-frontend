import { useCallback, useEffect, useState } from 'react';
import api, { descargarArchivo, mensajeError, obtenerUrlImagen } from '../api/client';
import { useToast } from '../context/ToastContext';
import { dinero, ESTADOS_SOPORTE, fechaLegible } from '../utils';
import Modal from './Modal';

/**
 * Lista de soportes de pago con visor de imágenes y acciones
 * Aprobar / Rechazar (admin y moderador).
 */
export default function SoportesPendientes({ alCambiar }) {
  const { notificar } = useToast();
  const [soportes, setSoportes] = useState([]);
  const [estado, setEstado] = useState('pendiente');
  const [cargando, setCargando] = useState(true);

  const [visor, setVisor] = useState(null); // {soporte, url, ficha}
  const [rechazar, setRechazar] = useState(null); // soporte a rechazar
  const [aprobarM, setAprobarM] = useState(null); // soporte a aprobar (motivo opcional)
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/soportes-pago', { params: { estado } });
      setSoportes(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [estado, notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Abre el visor cargando la imagen con el JWT + contexto de pago del usuario. */
  const abrirVisor = async (soporte) => {
    try {
      const [url, ficha] = await Promise.all([
        obtenerUrlImagen(`/soportes-pago/${soporte.id}/archivo`),
        api.get(`/usuarios/${soporte.usuario_id}`).then((r) => r.data).catch(() => null),
      ]);
      setVisor({ soporte, url, ficha });
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo cargar la imagen.'), 'error');
    }
  };

  const cerrarVisor = () => {
    if (visor?.url) URL.revokeObjectURL(visor.url);
    setVisor(null);
  };

  const aprobar = async (soporte, motivo) => {
    setOcupado(true);
    try {
      const { data } = await api.put(
        `/soportes-pago/${soporte.id}/aprobar`,
        motivo?.trim() ? { comentario: motivo.trim().slice(0, 200) } : {}
      );
      notificar(data.mensaje, 'exito');
      setAprobarM(null);
      setComentario('');
      cerrarVisor();
      await cargar();
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const confirmarRechazo = async (e) => {
    e.preventDefault();
    if (!comentario.trim()) return notificar('El comentario es obligatorio al rechazar.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.put(`/soportes-pago/${rechazar.id}/rechazar`, { comentario: comentario.trim() });
      notificar(data.mensaje, 'exito');
      setRechazar(null);
      setComentario('');
      cerrarVisor();
      await cargar();
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'pendiente', t: '🟡 Pendientes' },
            { v: 'aprobado', t: '✅ Aprobados' },
            { v: 'rechazado', t: '⛔ Rechazados' },
            { v: 'todas', t: '🗂️ Todos' },
          ].map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => setEstado(f.v)}
              className={`tab ${estado === f.v ? 'tab-activa' : ''}`}
            >
              {f.t}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{soportes.length} resultado(s)</span>
        <button
          type="button"
          className="btn-mini"
          title="Descarga el CSV de pagos con montos, acompañante y revisor"
          onClick={async () => {
            try {
              await descargarArchivo(`/soportes-pago/exportar?estado=${estado}`, `pagos-${estado}.csv`);
              notificar('CSV descargado.', 'exito');
            } catch (error) {
              notificar(mensajeError(error, 'No se pudo exportar el CSV.'), 'error');
            }
          }}
        >
          📥 Exportar CSV
        </button>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
        </div>
      ) : soportes.length === 0 ? (
        <div className="panela p-8 text-center text-sm text-slate-400">
          🎉 No hay soportes en este estado.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {soportes.map((s) => {
            const est = ESTADOS_SOPORTE[s.estado] || ESTADOS_SOPORTE.pendiente;
            return (
              <article key={s.id} className="panela flex gap-3 p-3.5">
                {/* Miniatura */}
                <button
                  type="button"
                  onClick={() => abrirVisor(s)}
                  className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 transition hover:border-amber-400/60"
                  title="Ver imagen"
                  aria-label={`Ver imagen del soporte de ${s.usuario_nombre}`}
                >
                  <Miniatura id={s.id} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{s.usuario_nombre}</p>
                      <p className="truncate text-xs text-slate-500">C.C. {s.usuario_cedula}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${est.clase}`}>
                      {est.texto}
                    </span>
                  </div>

                  <p className="mt-1.5 font-display text-lg font-extrabold text-amber-300">
                    {dinero(s.monto_reportado)}
                    <span className="ml-2 text-[11px] font-semibold uppercase text-slate-500">
                      {s.tipo === 'pago_total' ? 'Pago total' : 'Abono'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">{fechaLegible(s.created_at)}</p>

                  {s.estado === 'pendiente' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn-mini flex-1 !text-emerald-300"
                        onClick={() => {
                          setAprobarM(s);
                          setComentario('');
                        }}
                        disabled={ocupado}
                      >
                        ✅ Aprobar
                      </button>
                      <button
                        type="button"
                        className="btn-mini flex-1 !text-rose-300"
                        onClick={() => {
                          setRechazar(s);
                          setComentario('');
                        }}
                      >
                        ⛔ Rechazar
                      </button>
                    </div>
                  )}
                  {s.estado !== 'pendiente' && s.comentario_revision && (
                    <p className="mt-1 truncate text-[11px] text-slate-400">💬 {s.comentario_revision}</p>
                  )}
                  {s.estado !== 'pendiente' && s.revisado_por_nombre && (
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      👤 {s.revisado_por_nombre}{s.revisado_en ? ` · ${fechaLegible(s.revisado_en)}` : ''}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ================= Visor de imagen ================= */}
      <Modal abierto={!!visor} titulo="Visor de soporte de pago" onCerrar={cerrarVisor} ancho="lg">
        {visor && (
          <div className="space-y-4">
            <div className="flex justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              <img src={visor.url} alt="Soporte de pago" className="max-h-[55vh] w-auto object-contain" />
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Usuario</p>
                <p className="font-semibold text-white">
                  {visor.soporte.usuario_nombre} · {visor.soporte.usuario_cedula}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Monto reportado</p>
                <p className="font-semibold text-amber-300">
                  {dinero(visor.soporte.monto_reportado)} · {visor.soporte.tipo === 'pago_total' ? 'Pago total' : 'Abono'}
                </p>
              </div>
            </div>

            {/* Contexto de pago del usuario para validar con criterio */}
            {visor.ficha?.usuario && (
              <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-3 text-sm">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-sky-300">💳 Estado de pago del usuario</p>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
                    <p className="font-bold tabular-nums text-white">
                      {dinero(Number(visor.ficha.usuario.monto_abonado || 0) + Number(visor.ficha.usuario.saldo_pendiente || 0) || 50000 + Number(visor.ficha.usuario.total_acompanantes || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Abonado</p>
                    <p className="font-bold tabular-nums text-emerald-300">{dinero(visor.ficha.usuario.monto_abonado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo</p>
                    <p className="font-bold tabular-nums text-amber-300">{dinero(visor.ficha.usuario.saldo_pendiente)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Acompañantes</p>
                    <p className="font-bold text-slate-200" title={(visor.ficha.acompanantes?.lista || []).map((a) => a.nombre).join(', ')}>
                      {visor.ficha.acompanantes?.cantidad
                        ? `${visor.ficha.acompanantes.cantidad} · ${dinero(visor.ficha.acompanantes.total)}`
                        : '—'}
                    </p>
                  </div>
                </div>
                {visor.soporte.estado === 'pendiente' && (
                  <p className="mt-2 text-center text-xs text-sky-200">
                    Al aprobar {dinero(visor.soporte.monto_reportado)} el saldo queda en{' '}
                    <strong className="tabular-nums">
                      {dinero(Math.max(0, Number(visor.ficha.usuario.saldo_pendiente || 0) - Number(visor.soporte.monto_reportado || 0)))}
                    </strong>
                    .
                  </p>
                )}
              </div>
            )}

            {visor.soporte.estado === 'pendiente' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="btn-peligro" onClick={() => setRechazar(visor.soporte)} disabled={ocupado}>
                  ⛔ Rechazar
                </button>
                <button
                  type="button"
                  className="btn-exito"
                  onClick={() => {
                    setAprobarM(visor.soporte);
                    setComentario('');
                  }}
                  disabled={ocupado}
                >
                  {`✅ Aprobar ${dinero(visor.soporte.monto_reportado)} y acreditar`}
                </button>
              </div>
            ) : (
              <div className="space-y-1 text-right text-sm text-slate-400">
                <p>
                  Estado: <strong>{(ESTADOS_SOPORTE[visor.soporte.estado] || {}).texto}</strong>
                  {visor.soporte.revisado_en ? ` · ${fechaLegible(visor.soporte.revisado_en)}` : ''}
                </p>
                {visor.soporte.revisado_por_nombre && (
                  <p>👤 Revisado por <strong className="text-slate-200">{visor.soporte.revisado_por_nombre}</strong></p>
                )}
                {visor.soporte.comentario_revision && (
                  <p>💬 Motivo: <strong className="text-slate-200">{visor.soporte.comentario_revision}</strong></p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================= Modal aprobar (motivo opcional) ================= */}
      <Modal
        abierto={!!aprobarM}
        titulo="Aprobar soporte"
        onCerrar={() => {
          setAprobarM(null);
          setComentario('');
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            aprobar(aprobarM, comentario);
          }}
          className="space-y-3"
        >
          <p className="text-sm text-slate-400">
            Se acreditan <strong className="text-amber-300">{aprobarM && dinero(aprobarM.monto_reportado)}</strong> a{' '}
            <strong className="text-slate-200">{aprobarM?.usuario_nombre}</strong> en la Caja de Inscripción. El motivo
            es <strong className="text-slate-200">opcional</strong> y queda registrado con tu nombre.
          </p>
          <textarea
            className="campo min-h-20"
            placeholder="Motivo (opcional). Ej: transferencia verificada en Nequi."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={200}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-fantasma"
              onClick={() => {
                setAprobarM(null);
                setComentario('');
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-exito" disabled={ocupado}>
              {ocupado ? 'Procesando…' : '✅ Confirmar aprobación'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= Modal rechazo ================= */}
      <Modal
        abierto={!!rechazar}
        titulo="Rechazar soporte"
        onCerrar={() => {
          setRechazar(null);
          setComentario('');
        }}
      >
        <form onSubmit={confirmarRechazo} className="space-y-3">
          <p className="text-sm text-slate-400">
            Explica al usuario el motivo del rechazo. <strong className="text-slate-200">Es obligatorio.</strong>
          </p>
          <textarea
            className="campo min-h-24"
            placeholder="Ej: La imagen no se lee, sube una foto más clara."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-fantasma"
              onClick={() => {
                setRechazar(null);
                setComentario('');
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-peligro" disabled={ocupado}>
              {ocupado ? 'Enviando…' : 'Rechazar soporte'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** Miniatura de la imagen (carga con el JWT; falla en silencio). */
function Miniatura({ id }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let viva = true;
    obtenerUrlImagen(`/soportes-pago/${id}/archivo`)
      .then((u) => viva && setUrl(u))
      .catch(() => {});
    return () => {
      viva = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return url ? (
    <img src={url} alt="Soporte" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-lg text-slate-600">🖼️</span>
  );
}

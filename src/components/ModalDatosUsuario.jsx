import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { ESTADOS_SOPORTE, copiarTexto, dinero, estadoPago, fechaLegible, bloqueEventoWhatsApp } from '../utils';
import Modal from './Modal';

const ROTULOS = { admin: 'Administrador', moderador: 'Moderador', usuario: 'Usuario' };

/** Iniciales del nombre para el avatar. */
const iniciales = (nombre = '') =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/** Número colombiano normalizado para wa.me (ej: 3133506369 → 573133506369). */
function numeroWhatsApp(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('57') && d.length >= 12 ? d : `57${d}`;
}

/** Texto formal para copiar / enviar por WhatsApp (no es chat, es ficha). */
function mensajeFicha(ficha, config = {}) {
  const u = ficha.usuario;
  const est = estadoPago(u.estado_pago);
  const esStaff = u.rol === 'admin' || u.rol === 'moderador';
  const acomp = ficha.acompanantes || { lista: [], cantidad: 0, total: 0 };
  const combo = ficha.combo || { persons: 1, items: [] };
  // Total real (abonado + saldo) para soportar monto de inscripción configurable.
  const total = esStaff ? 0 : Number(u.monto_abonado || 0) + Number(u.saldo_pendiente || 0) || 50000 + Number(acomp.total || 0);
  const pendientes = (ficha.soportes || []).filter((s) => s.estado === 'pendiente').length;
  return [
    `FICHA DE USUARIO — ${u.nombre}`,
    `Cédula: ${u.cedula} · Email: ${u.email} · WhatsApp: ${u.whatsapp || 'sin registrar'}`,
    `Rol: ${ROTULOS[u.rol] || u.rol}${esStaff ? ' (sin saldo a pagar)' : ''}`,
    `Pago: ${esStaff ? 'Staff sin cargo' : `${est.texto}${u.pago_validado ? ' (validado)' : ' (sin validar)'}`} · Abonado: ${dinero(esStaff ? 0 : u.monto_abonado)} · Total: ${dinero(total)} · Saldo: ${dinero(esStaff ? 0 : u.saldo_pendiente)}`,
    acomp.cantidad
      ? `Acompañantes (${acomp.cantidad}): ${acomp.lista.map((a) => `${a.nombre} (${dinero(a.monto)})`).join(' | ')}`
      : 'Acompañantes: ninguno',
    `Combo (${combo.persons} persona(s)): ${(combo.items || []).map((i) => `${i.entregado}/${i.requerido} ${i.producto}`).join(' · ') || 'sin definir'}${u.combo_completado ? ' (completado)' : ''}`,
    `Encuesta: ${ficha.encuesta.completada ? `respondida el ${fechaLegible(ficha.encuesta.completada_en)}` : 'pendiente'} · Soportes: ${(ficha.soportes || []).length} (${pendientes} pendientes)`,
    '',
    bloqueEventoWhatsApp(config),
  ].join('\n');
}

function Seccion({ titulo, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{titulo}</h4>
      <div className="space-y-1.5 text-sm">{children}</div>
    </section>
  );
}

function Fila({ etiqueta, valor, fuerte }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500">{etiqueta}</dt>
      <dd className={`truncate text-right tabular-nums ${fuerte || 'text-slate-200'}`}>{valor}</dd>
    </div>
  );
}

/**
 * Ficha profesional del usuario (admin y moderador).
 * Props: usuario ({id, nombre}) o null, onCerrar.
 * Datos frescos de GET /api/usuarios/:id.
 *
 * Intent: el staff valida de un vistazo identidad, pago y combo antes de
 * entregar o cobrar. Debe sentirse ordenado y confiable, no un chat.
 * Hierarchy: header (identidad) → pago (héroe con progreso) → grid de detalle.
 */
export default function ModalDatosUsuario({ usuario, onCerrar }) {
  const { notificar } = useToast();
  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [config, setConfig] = useState({});

  useEffect(() => {
    if (!usuario?.id) {
      setFicha(null);
      return;
    }
    let vivo = true;
    setCargando(true);
    api
      .get(`/usuarios/${usuario.id}`)
      .then((r) => vivo && setFicha(r.data))
      .catch((e) => notificar(mensajeError(e, 'No se pudo cargar la ficha.'), 'error'))
      .finally(() => vivo && setCargando(false));
    api
      .get('/configuracion')
      .then((r) => vivo && setConfig(r.data || {}))
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const mensaje = ficha ? mensajeFicha(ficha, config) : '';
  const numero = ficha ? numeroWhatsApp(ficha.usuario.whatsapp) : '';

  const copiar = async () => {
    const ok = await copiarTexto(mensaje);
    notificar(ok ? 'Datos copiados al portapapeles.' : 'No se pudo copiar.', ok ? 'exito' : 'error');
  };

  return (
    <Modal abierto={!!usuario} titulo={`👥 Ficha de ${usuario?.nombre || 'usuario'}`} onCerrar={onCerrar} ancho="lg">
      {cargando ? (
        <p className="py-6 text-center text-sm text-slate-400">Cargando ficha…</p>
      ) : !ficha ? (
        <p className="py-6 text-center text-sm text-slate-400">No se encontraron datos.</p>
      ) : (
        (() => {
          const u = ficha.usuario;
          const est = estadoPago(u.estado_pago);
          const esStaff = u.rol === 'admin' || u.rol === 'moderador';
          const acomp = ficha.acompanantes || { lista: [], cantidad: 0, total: 0 };
          const total = esStaff ? 0 : Number(u.monto_abonado || 0) + Number(u.saldo_pendiente || 0) || 50000 + Number(acomp.total || 0);
          const abonado = esStaff ? 0 : Number(u.monto_abonado || 0);
          const saldo = esStaff ? 0 : Number(u.saldo_pendiente || 0);
          const progreso = total > 0 ? Math.min(100, Math.round((abonado / total) * 100)) : 100;
          const pendientes = (ficha.soportes || []).filter((s) => s.estado === 'pendiente').length;
          return (
            <div className="space-y-4">
              {/* ---------- Encabezado: identidad ---------- */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-fuchsia-500 text-base font-extrabold text-slate-950">
                  {iniciales(u.nombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-extrabold text-white">{u.nombre}</p>
                  <p className="truncate text-xs text-slate-400">
                    Cédula {u.cedula} · {u.email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {ROTULOS[u.rol] || u.rol}
                  </span>
                  {esStaff ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sin cargo
                    </span>
                  ) : (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${est.clase}`}>
                      {est.texto}
                    </span>
                  )}
                  {!esStaff && u.pago_validado === 1 && (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Validado
                    </span>
                  )}
                  {u.combo_completado === 1 && (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Combo ✓
                    </span>
                  )}
                </div>
              </div>

              {/* ---------- Pago: héroe ---------- */}
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
                <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
                    <p className="font-display text-lg font-extrabold tabular-nums text-white">{dinero(total)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Abonado</p>
                    <p className="font-display text-lg font-extrabold tabular-nums text-emerald-300">{dinero(abonado)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saldo</p>
                    <p className="font-display text-lg font-extrabold tabular-nums text-amber-300">{dinero(saldo)}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-all"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] tabular-nums text-slate-500">{progreso}% pagado</p>
              </div>

              {/* ---------- Detalle en grid ---------- */}
              <div className="grid gap-3 md:grid-cols-2">
                <Seccion titulo="📞 Contacto">
                  <Fila etiqueta="WhatsApp" valor={u.whatsapp || '—'} />
                  <Fila etiqueta="Email" valor={u.email} />
                  <Fila etiqueta="Cédula" valor={u.cedula} />
                  <Fila etiqueta="UUID" valor={u.uuid || '—'} />
                </Seccion>

                <Seccion titulo={`👥 Acompañantes (${acomp.cantidad}/1)`}>
                  {acomp.cantidad ? (
                    acomp.lista.map((a) => (
                      <Fila key={a.id} etiqueta={a.nombre} valor={dinero(a.monto)} fuerte="font-semibold text-sky-300 tabular-nums" />
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">Ninguno registrado.</p>
                  )}
                </Seccion>

                <Seccion titulo={`🎁 Combo (${(ficha.combo?.persons || 1)} persona(s))`}>
                  {(ficha.combo?.items || []).length === 0 ? (
                    <p className="text-xs text-slate-500">Sin combo definido.</p>
                  ) : (
                    (ficha.combo.items || []).map((i) => (
                      <Fila key={i.inventario_id} etiqueta={i.producto} valor={`${i.entregado}/${i.requerido}`} />
                    ))
                  )}
                  <Fila
                    etiqueta="Estado"
                    valor={u.combo_completado ? 'Completado' : 'En curso'}
                    fuerte={u.combo_completado ? 'font-semibold text-emerald-300' : 'text-slate-300'}
                  />
                </Seccion>

                <Seccion titulo="📋 Encuesta">
                  <Fila
                    etiqueta="Estado"
                    valor={ficha.encuesta.completada ? `Respondida · ${fechaLegible(ficha.encuesta.completada_en)}` : 'Pendiente'}
                    fuerte={ficha.encuesta.completada ? 'text-emerald-300' : 'text-rose-300'}
                  />
                  <Fila etiqueta="Respuestas" valor={`${(ficha.encuesta.respuestas || []).length}`} />
                </Seccion>

                <div className="md:col-span-2">
                  <Seccion titulo={`🧾 Soportes (${(ficha.soportes || []).length} · ${pendientes} pendientes)`}>
                    {(ficha.soportes || []).length === 0 ? (
                      <p className="text-xs text-slate-500">Sin soportes enviados.</p>
                    ) : (
                      <ul className="divide-y divide-white/5">
                        {(ficha.soportes || []).slice(0, 4).map((s) => {
                          const b = ESTADOS_SOPORTE[s.estado] || ESTADOS_SOPORTE.pendiente;
                          return (
                            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                              <span className="text-xs text-slate-400">{fechaLegible(s.created_at)} · {s.tipo === 'pago_total' ? 'Total' : 'Abono'}</span>
                              <span className="flex items-center gap-2">
                                <strong className="text-sm tabular-nums text-white">{dinero(s.monto_reportado)}</strong>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${b.clase}`}>{b.texto}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Seccion>
                </div>
              </div>

              {/* ---------- Acciones ---------- */}
              <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
                <button type="button" className="btn-fantasma" onClick={copiar}>
                  📋 Copiar datos
                </button>
                {numero ? (
                  <a
                    className="btn-oro"
                    href={`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 Enviar por WhatsApp
                  </a>
                ) : (
                  <button type="button" className="btn-oro opacity-50" disabled title="Este usuario no tiene WhatsApp">
                    💬 Sin WhatsApp
                  </button>
                )}
                <button type="button" className="btn-fantasma" onClick={onCerrar}>
                  Cerrar
                </button>
              </div>
            </div>
          );
        })()
      )}
    </Modal>
  );
}

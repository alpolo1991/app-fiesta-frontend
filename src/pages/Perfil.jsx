import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { mensajeError, obtenerUrlImagen } from '../api/client';
import CambiarPassword from '../components/CambiarPassword';
import Modal from '../components/Modal';
import ModalPago from '../components/ModalPago';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ESTADOS_SOPORTE, dinero, estadoPago, fechaLegible } from '../utils';

/** Dashboard del usuario: mi pago, mi combo, mi encuesta. */
export default function Perfil() {
  const { usuario, actualizarUsuario } = useAuth();
  const { notificar } = useToast();

  const [soportes, setSoportes] = useState([]);
  const [encuesta, setEncuesta] = useState({ completada: false, respuestas: [] });
  const [combo, setCombo] = useState(null);
  const [acompanantes, setAcompanantes] = useState({ lista: [], cantidad: 0, total: 0 });
  const [modalPago, setModalPago] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', whatsapp: '' });
  const [guardando, setGuardando] = useState(false);
  const [visor, setVisor] = useState(null); // {soporte, url} comprobante propio
  const [verDetallePago, setVerDetallePago] = useState(false);
  const soportesRef = useRef(null);

  // Si la contraseña es temporal, exigir el cambio: abrir el modal automáticamente.
  useEffect(() => {
    if (usuario?.password_temporal) setModalPassword(true);
  }, [usuario?.password_temporal]);

  /** Recarga todo lo que depende del usuario. */
  const recargar = useCallback(async () => {
    if (!usuario) return;
    try {
      const [me, misSoportes, miEncuesta, miCombo, misAcomp] = await Promise.all([
        api.get('/usuarios/me'),
        api.get('/soportes-pago/mios'),
        api.get('/encuesta/mia'),
        api.get(`/entregas/usuario/${usuario.id}`),
        api.get('/acompanantes/mios'),
      ]);
      actualizarUsuario(me.data);
      setSoportes(misSoportes.data);
      setEncuesta(miEncuesta.data);
      setCombo(miCombo.data);
      setAcompanantes(misAcomp.data);
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo cargar tu información.'), 'error');
    }
  }, [usuario, actualizarUsuario, notificar]);

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  useEffect(() => {
    if (usuario) setForm({ nombre: usuario.nombre || '', email: usuario.email || '', whatsapp: usuario.whatsapp || '' });
  }, [usuario]);

  if (!usuario) return null;

  const estado = estadoPago(usuario.estado_pago);
  const abonado = Number(usuario.monto_abonado || 0);
  const saldo = Number(usuario.saldo_pendiente ?? 50000);
  const montoAcompanantes = Number(acompanantes.total || 0);
  const tieneAcompanante = acompanantes.cantidad > 0;
  const nombresAcompanantes = acompanantes.lista.map((a) => a.nombre).join(', ');
  // Total real desde backend (abonado + saldo) para soportar monto configurable.
  const totalAPagar = abonado + saldo > 0 ? abonado + saldo : 50000 + montoAcompanantes;
  const CUPO = totalAPagar - montoAcompanantes;
  const progresoPago = Math.min(100, Math.round((abonado / totalAPagar) * 100));
  // Pago total validado: héroe verde colapsable en vez de todo el detalle.
  // Incluye acompañante porque saldo y estado_pago ya suman todo el total.
  const pagadoTotal = saldo <= 0 && usuario.estado_pago === 'pagado' && abonado > 0;
  const nAprobados = soportes.filter((s) => s.estado === 'aprobado').length;

  const irAComprobantes = () => {
    soportesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Qué ha reclamado ya el usuario (agrupado por producto)
  const reclamado = (combo?.entregas || []).reduce((acc, e) => {
    acc[e.producto] = (acc[e.producto] || 0) + e.cantidad;
    return acc;
  }, {});

  const guardarPerfil = async (e) => {
    e.preventDefault();
    const w = form.whatsapp.trim().replace(/\D/g, '');
    if (w && !/^\d{7,15}$/.test(w)) {
      notificar('El WhatsApp debe tener solo dígitos (7 a 15).', 'error');
      return;
    }
    setGuardando(true);
    try {
      const { data } = await api.put('/usuarios/me', form);
      actualizarUsuario(data.usuario);
      notificar('Perfil actualizado.', 'exito');
      setEditando(false);
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo cargar tu información.'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  /** Abre el comprobante propio (el dueño sí puede ver su imagen). */
  const abrirComprobante = async (s) => {
    try {
      const url = await obtenerUrlImagen(`/soportes-pago/${s.id}/archivo`);
      setVisor({ soporte: s, url });
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo cargar el comprobante.'), 'error');
    }
  };

  const cerrarVisor = () => {
    if (visor?.url) URL.revokeObjectURL(visor.url);
    setVisor(null);
  };

  return (
    <div className="space-y-6">
      {usuario.password_temporal === 1 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          🔑 Tienes una <strong>contraseña temporal</strong>. Cámbiala ahora para continuar con normalidad.{' '}
          <button type="button" className="font-bold underline" onClick={() => setModalPassword(true)}>
            Cambiar contraseña
          </button>
        </div>
      )}
      {/* ================= Encabezado ================= */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Hola de nuevo 👋</p>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">{usuario.nombre}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cédula {usuario.cedula} · {usuario.email}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${estado.clase}`}>
          {estado.icono} {estado.texto}
          {usuario.pago_validado ? ' · validado' : ''}
        </span>
      </div>

      {/* ================= 3 tarjetas ================= */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* --- Mi pago --- */}
        <section className="panela p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">💳 Mi pago</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${estado.clase}`}>{estado.texto}</span>
          </header>

          {pagadoTotal ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-4 text-center">
                <p className="font-display text-2xl font-extrabold text-emerald-300">PAGADO ✅</p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  {dinero(abonado)} de {dinero(totalAPagar)} · ¡nos vemos en la fiesta! 🎉
                </p>
              </div>
              <button
                type="button"
                className="btn-mini w-full"
                onClick={() => setVerDetallePago((v) => !v)}
              >
                {verDetallePago ? '▲ Ocultar detalle' : '▼ Ver detalle del pago'}
              </button>
            </div>
          ) : null}

          {(!pagadoTotal || verDetallePago) && (
          <>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Cupo</dt>
              <dd className="font-semibold text-white">{dinero(CUPO)}</dd>
            </div>
            {tieneAcompanante && (
              <div className="flex justify-between">
                <dt className="truncate pr-2 text-slate-400" title={nombresAcompanantes}>
                  👥 {acompanantes.cantidad} acompañante(s){nombresAcompanantes ? ` · ${nombresAcompanantes}` : ''}
                </dt>
                <dd className="shrink-0 font-semibold text-sky-300">+{dinero(montoAcompanantes)}</dd>
              </div>
            )}
            {tieneAcompanante && (
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <dt className="text-slate-400">Total a pagar</dt>
                <dd className="font-semibold text-white">{dinero(totalAPagar)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-400">Abonado</dt>
              <dd className="font-semibold text-emerald-300">{dinero(abonado)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1.5">
              <dt className="text-slate-400">Saldo pendiente</dt>
              <dd className="font-bold text-amber-300">{dinero(saldo)}</dd>
            </div>
          </dl>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${progresoPago}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-500">{progresoPago}% pagado</p>
          </>
          )}
        </section>

        {/* --- Mi combo --- */}
        <section className="panela p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">🍻 Mi combo</h2>
            {combo?.combo?.completado ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                COMPLETADO
              </span>
            ) : (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                EN CURSO
              </span>
            )}
          </header>

          <p className="text-xs text-slate-400">
            👤 Cliente:{' '}
            <strong className={combo?.combo?.cliente === 'completado' ? 'text-emerald-300' : 'text-amber-300'}>
              {combo?.combo?.cliente === 'completado' ? '✅ completado' : combo?.combo?.cliente === 'parcial' ? '🟡 parcial' : '⏳ pendiente'}
            </strong>
            {combo?.combo?.acompanantes && (
              <span>
                {' '}· 👥 Acompañante(s):{' '}
                <strong className={combo.combo.acompanantes.estado === 'completado' ? 'text-emerald-300' : 'text-amber-300'}>
                  {combo.combo.acompanantes.estado === 'completado'
                    ? '✅ completado'
                    : combo.combo.acompanantes.estado === 'pendiente'
                      ? `⏳ pendiente (faltan ${combo.combo.acompanantes.faltan})`
                      : '⏳ en espera'}
                </strong>
              </span>
            )}
          </p>
          {(combo?.combo?.entregadoTotal || 0) === 0 && (combo?.combo?.requeridoTotal || 0) > 0 && (
            <p className="text-xs tabular-nums text-slate-500">
              Total a reclamar: {combo.combo.requeridoTotal} uds.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(combo?.combo?.items || []).length === 0 ? (
              <p className="col-span-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-xs text-slate-500">
                El combo aún no está definido.
              </p>
            ) : (
              (combo.combo.items || []).map((it) => (
                <div key={it.inventario_id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="font-display text-xl font-extrabold tabular-nums text-white">
                    {it.entregado}/{it.requerido}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">{it.producto}</p>
                </div>
              ))
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {combo?.combo?.completado
              ? '🎉 ¡Ya reclamaste todo tu combo!'
              : 'Recoge tus productos en el evento mostrando tu cédula.'}
          </p>

          {/* Qué ha reclamado */}
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ya reclamado</p>
            {Object.keys(reclamado).length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Todavía no has reclamado productos.</p>
            ) : (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(reclamado).map(([producto, cantidad]) => (
                  <li
                    key={producto}
                    className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300"
                  >
                    ✓ {cantidad} × {producto}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* --- Mi encuesta --- */}
        <section className="panela p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">📋 Mi encuesta</h2>
            {encuesta.completada ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                RESPONDIDA
              </span>
            ) : (
              <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                PENDIENTE
              </span>
            )}
          </header>

          <p className="text-sm text-slate-400">
            {encuesta.completada
              ? `Respondida el ${fechaLegible(encuesta.completada_en)} · ${encuesta.respuestas.length} respuesta(s)`
              : 'Cuéntanos tus preferencias para preparar la mejor fiesta. Solo puedes responder una vez.'}
          </p>

          <Link to="/encuesta" className={`mt-4 block w-full text-center ${encuesta.completada ? 'btn-fantasma' : 'btn-oro'}`}>
            {encuesta.completada ? 'Ver mis respuestas' : '📋 Responder encuesta'}
          </Link>
        </section>
      </div>

      {/* ================= Botón grande de pago ================= */}
      {pagadoTotal ? (
        <button
          type="button"
          onClick={irAComprobantes}
          className="btn-exito w-full !rounded-2xl !px-6 !py-4 !text-base"
          title="Estás al día: ver tus comprobantes aprobados"
        >
          ✅ Pagado al día · Ver mis comprobantes ({nAprobados}/{soportes.length})
        </button>
      ) : (
        <button type="button" onClick={() => setModalPago(true)} className="btn-grande" title={tieneAcompanante ? 'Aún debes saldo (incluye acompañante)' : 'Pagar o abonar tu inscripción'}>
          💳 Pagar / Abonar · saldo {dinero(saldo)}
        </button>
      )}

      {/* ================= Soportes y perfil ================= */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Mis soportes --- */}
        <section ref={soportesRef} className="panela scroll-mt-24 p-5 lg:col-span-2">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">🧾 Mis soportes de pago</h2>
            <span className="text-xs text-slate-500">
              {soportes.length} enviado(s){pagadoTotal ? ` · ${nAprobados} aprobado(s) ✅` : ''}
            </span>
          </header>

          {soportes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-500">
              Aún no has subido soportes de pago. Usa el botón <strong className="text-slate-300">Pagar / Abonar</strong>{' '}
              para enviar el primero.
            </p>
          ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="th-tabla">Fecha</th>
                    <th className="th-tabla">Tipo</th>
                    <th className="th-tabla">Monto</th>
                    <th className="th-tabla">Estado</th>
                    <th className="th-tabla">Detalle</th>
                    <th className="th-tabla text-right">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {soportes.map((s) => {
                    const est = ESTADOS_SOPORTE[s.estado] || ESTADOS_SOPORTE.pendiente;
                    return (
                      <tr key={s.id} className="hover:bg-white/[0.03]">
                        <td className="td-tabla whitespace-nowrap text-slate-400">{fechaLegible(s.created_at)}</td>
                        <td className="td-tabla capitalize">{s.tipo === 'pago_total' ? 'Pago total' : 'Abono'}</td>
                        <td className="td-tabla font-semibold text-white">{dinero(s.monto_reportado)}</td>
                        <td className="td-tabla">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${est.clase}`}>
                            {est.texto}
                          </span>
                        </td>
                        <td className="td-tabla text-xs text-slate-400">
                          {s.estado === 'rechazado' && s.comentario_revision
                            ? `💬 ${s.comentario_revision}`
                            : s.estado === 'pendiente'
                              ? 'Esperando validación'
                              : '✅ Aceptado'}
                        </td>
                        <td className="td-tabla text-right">
                          <button type="button" className="btn-mini" onClick={() => abrirComprobante(s)} title="Ver la foto que enviaste">
                            🖼️ Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2.5 md:hidden">
              {soportes.map((s) => {
                const est = ESTADOS_SOPORTE[s.estado] || ESTADOS_SOPORTE.pendiente;
                return (
                  <article key={s.id} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold capitalize text-slate-300">
                        {s.tipo === 'pago_total' ? 'Pago total' : 'Abono'}
                      </p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${est.clase}`}>
                        {est.texto}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-display text-lg font-extrabold tabular-nums text-white">
                        {dinero(s.monto_reportado)}
                      </p>
                      <p className="shrink-0 text-[11px] text-slate-500">{fechaLegible(s.created_at)}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {s.estado === 'rechazado' && s.comentario_revision
                        ? `💬 ${s.comentario_revision}`
                        : s.estado === 'pendiente'
                          ? 'Esperando validación'
                          : '✅ Aceptado'}
                    </p>
                    <button type="button" className="btn-mini w-full" onClick={() => abrirComprobante(s)} title="Ver la foto que enviaste">
                      🖼️ Ver comprobante
                    </button>
                  </article>
                );
              })}
            </div>
          </>
          )}
        </section>

        {/* --- Mi perfil --- */}
        <section className="panela p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">👤 Mi perfil</h2>
            <button type="button" className="btn-mini" onClick={() => setEditando((v) => !v)}>
              {editando ? 'Cancelar' : 'Editar'}
            </button>
          </header>

          {!editando ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Nombre</dt>
                <dd className="font-semibold text-white">{usuario.nombre}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Email</dt>
                <dd className="break-all font-semibold text-white">{usuario.email}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">WhatsApp</dt>
                <dd className="font-semibold text-white">{usuario.whatsapp || '—'}</dd>
              </div>
            </dl>
          ) : (
            <form onSubmit={guardarPerfil} className="space-y-3">
              <div>
                <label className="etiqueta" htmlFor="perfil-nombre">Nombre</label>
                <input
                  id="perfil-nombre"
                  className="campo"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  minLength={3}
                  maxLength={80}
                  required
                />
              </div>
              <div>
                <label className="etiqueta" htmlFor="perfil-email">Email</label>
                <input
                  id="perfil-email"
                  type="email"
                  className="campo"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label className="etiqueta" htmlFor="perfil-wa">WhatsApp</label>
                <input
                  id="perfil-wa"
                  className="campo"
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  placeholder="3001234567"
                  inputMode="tel"
                  minLength={7}
                  maxLength={15}
                />
              </div>
              <button type="submit" className="btn-oro w-full" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}

          <button type="button" onClick={() => setModalPassword(true)} className="btn-fantasma mt-4 w-full">
            🔒 Cambiar contraseña
          </button>
        </section>
      </div>

      {/* ================= Modales ================= */}
      <ModalPago abierto={modalPago} onCerrar={() => setModalPago(false)} usuario={usuario} onEnviado={recargar} />
      <CambiarPassword abierto={modalPassword} onCerrar={() => setModalPassword(false)} />

      {/* Comprobante propio */}
      <Modal abierto={!!visor} titulo="🧾 Mi comprobante" onCerrar={cerrarVisor}>
        {visor && (
          <div className="space-y-3">
            <div className="flex justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              <img src={visor.url} alt="Comprobante de pago" className="max-h-[55vh] w-auto object-contain" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <span className="text-slate-400">
                {visor.soporte.tipo === 'pago_total' ? 'Pago total' : 'Abono'} · {fechaLegible(visor.soporte.created_at)}
              </span>
              <span className="flex items-center gap-2">
                <strong className="tabular-nums text-white">{dinero(visor.soporte.monto_reportado)}</strong>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${(ESTADOS_SOPORTE[visor.soporte.estado] || ESTADOS_SOPORTE.pendiente).clase}`}>
                  {(ESTADOS_SOPORTE[visor.soporte.estado] || ESTADOS_SOPORTE.pendiente).texto}
                </span>
              </span>
            </div>
            {visor.soporte.estado === 'rechazado' && visor.soporte.comentario_revision && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                💬 Motivo del rechazo: {visor.soporte.comentario_revision}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

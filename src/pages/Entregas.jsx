import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { estadoPago } from '../utils';

const FILTROS = [
  { v: 'todos', t: '👥 Todos' },
  { v: 'faltan', t: '⏳ Faltan por reclamar' },
  { v: 'parciales', t: '🟡 Parciales' },
  { v: 'completados', t: '✅ Completados' },
];

const ETIQUETA_ROL = { admin: '🛡️ Admin', moderador: '🧑‍⚖️ Moderador' };

/**
 * Vista de entregas (admin y moderador).
 * Combo por producto (cerveza, comida, torta, gaseosa × personas).
 * Buscador + entrega por producto. El combo se completa solo al entregar
 * todo lo requerido (sin botón manual).
 * Al staff se le etiqueta por rol (no pagan suscripción).
 */
export default function Entregas({ alCambiar }) {
  const { notificar } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [u, i] = await Promise.all([api.get('/entregas/pendientes'), api.get('/inventario')]);
      setUsuarios(u.data);
      setProductos(i.data.productos || []);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const stockDe = (inventarioId) => productos.find((p) => p.id === inventarioId)?.cantidad_disponible ?? 0;

  /** Regla estricta: rol usuario exige estado_pago === pagado. Staff exento. */
  const sinPagoConfirmado = (usuario) => usuario?.rol === 'usuario' && usuario?.estado_pago !== 'pagado';

  const filtrados = useMemo(() => {
    const t = busqueda.toLowerCase().trim();
    return usuarios.filter((u) => {
      const coincide = !t || [u.nombre, u.email, u.cedula].some((v) => String(v || '').toLowerCase().includes(t));
      if (!coincide) return false;
      if (filtro === 'faltan') return u.estado_combo === 'pendiente';
      if (filtro === 'parciales') return u.estado_combo === 'parcial';
      if (filtro === 'completados') return u.estado_combo === 'completado';
      return true;
    });
  }, [usuarios, busqueda, filtro]);

  /** Entrega unidades de un producto del combo. */
  const entregar = async (usuario, item) => {
    if (item.faltante <= 0) return;
    if (sinPagoConfirmado(usuario)) return notificar(`${usuario.nombre} no tiene el pago confirmado. Confirma el total antes de entregar.`, 'error');
    if (stockDe(item.inventario_id) <= 0) return notificar(`No queda stock de ${item.producto}.`, 'error');

    setOcupado(true);
    try {
      const { data } = await api.post('/entregas', {
        usuario_id: usuario.id,
        inventario_id: item.inventario_id,
        cantidad: 1,
        tipo: 'combo',
      });
      notificar(`${item.producto} entregada a ${usuario.nombre}${data.usuario.combo_completado ? ' · ¡combo entregado! 🎉' : ''}`, 'exito');
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
      {/* Controles */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="sr-only" htmlFor="buscar-entregas">Buscar usuario</label>
        <input
          id="buscar-entregas"
          className="campo max-w-sm"
          placeholder="🔍 Buscar usuario por nombre, cédula o email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button key={f.v} type="button" onClick={() => setFiltro(f.v)} className={`tab ${filtro === f.v ? 'tab-activa' : ''}`}>
              {f.t}
            </button>
          ))}
        </div>
      </div>

      {/* Lista en tabla (tablet y compu) */}
      <div className="panela hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr>
              <th className="th-tabla">Usuario</th>
              <th className="th-tabla">Pago / Rol</th>
              <th className="th-tabla">🎁 Combo</th>
              <th className="th-tabla">Estado</th>
              <th className="th-tabla text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {cargando ? (
              <tr>
                <td className="td-tabla py-8 text-center text-slate-500" colSpan={5}>
                  Cargando…
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td className="td-tabla py-8 text-center text-slate-500" colSpan={5}>
                  No hay usuarios con este filtro.
                </td>
              </tr>
            ) : (
              filtrados.map((u) => {
                const esStaff = u.rol !== 'usuario';
                const est = estadoPago(u.estado_pago);
                return (
                  <tr key={u.id} className="hover:bg-white/[0.03]">
                    <td className="td-tabla">
                      <p className="font-semibold text-white">{u.nombre}</p>
                      <p className="text-xs text-slate-500">
                        C.C. {u.cedula} · {u.email}
                      </p>
                      {Number(u.n_acompanantes) > 0 && (
                        <p className="mt-0.5 text-[11px] font-semibold text-sky-300" title={`Acompañantes: ${u.nombres_acompanantes || ''}`}>
                          👥 +{u.n_acompanantes} acompañante(s) · {u.combo_personas} persona(s)
                        </p>
                      )}
                      {!u.combo_reservado && (u.combo_items || []).length > 0 && (
                        <p className="mt-0.5 text-[11px] text-slate-500" title="Stock aún no reservado">
                          📦 Sin reserva de stock
                        </p>
                      )}
                    </td>
                    <td className="td-tabla">
                      {esStaff ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          {ETIQUETA_ROL[u.rol] || u.rol}
                        </span>
                      ) : (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${est.clase}`}>{est.texto}</span>
                      )}
                    </td>
                    <td className="td-tabla">
                      {(u.combo_items || []).length === 0 ? (
                        <span className="text-xs text-slate-500">Sin combo definido</span>
                      ) : (
                        <>
                        <p className="mb-1 text-[11px] text-slate-400">
                          👤 Cliente:{' '}
                          <strong className={u.combo_cliente === 'completado' ? 'text-emerald-300' : u.combo_cliente === 'parcial' ? 'text-amber-300' : 'text-slate-300'}>
                            {u.combo_cliente === 'completado' ? '✅ completado' : u.combo_cliente === 'parcial' ? '🟡 parcial' : '⏳ pendiente'}
                          </strong>
                          {u.combo_acompanantes && (
                            <span>
                              {' '}· 👥 Acompañante(s) ({u.combo_acompanantes.personas}):{' '}
                              <strong className={u.combo_acompanantes.estado === 'completado' ? 'text-emerald-300' : 'text-amber-300'}>
                                {u.combo_acompanantes.estado === 'completado'
                                  ? '✅ completado'
                                  : u.combo_acompanantes.estado === 'pendiente'
                                    ? `⏳ pendiente (faltan ${u.combo_acompanantes.faltan})`
                                    : '⏳ en espera'}
                              </strong>
                            </span>
                          )}
                        </p>
                        {(u.entregados || 0) === 0 && (
                          <p className="mb-1 text-[11px] tabular-nums text-slate-500">
                            Total a reclamar: {u.combo_total ?? '?'} uds.
                          </p>
                        )}
                        <ul className="space-y-1.5">
                          {u.combo_items.map((it) => {
                            const pct = it.requerido > 0 ? Math.min(100, Math.round((it.entregado / it.requerido) * 100)) : 0;
                            return (
                              <li key={it.inventario_id} className="min-w-[180px]">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-slate-200">{it.producto}</span>
                                  <span className="tabular-nums text-slate-400">
                                    {it.entregado}/{it.requerido}
                                  </span>
                                </div>
                                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-fuchsia-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        </>
                      )}
                    </td>
                    <td className="td-tabla">
                      {u.estado_combo === 'completado' ? (
                        <span className="text-xs font-bold text-emerald-300">✅ Completado</span>
                      ) : u.estado_combo === 'parcial' ? (
                        <span className="text-xs font-bold text-amber-300">🟡 Parcial</span>
                      ) : (
                        <span className="text-xs font-bold text-rose-300">⏳ Pendiente</span>
                      )}
                    </td>
                    <td className="td-tabla">
                      {u.estado_combo === 'completado' ? (
                        <p className="text-right text-xs font-bold text-emerald-300">✅ Combo entregado</p>
                      ) : (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {(u.combo_items || [])
                          .filter((it) => it.faltante > 0)
                          .map((it) => {
                            const bloqueado = ocupado || stockDe(it.inventario_id) <= 0 || sinPagoConfirmado(u);
                            const titulo = sinPagoConfirmado(u)
                              ? 'Sin pago confirmado: confirma el total antes de entregar'
                              : stockDe(it.inventario_id) > 0
                                ? `Entregar 1 ${it.producto} del combo`
                                : `Sin stock de ${it.producto}`;
                            return (
                              <button
                                key={it.inventario_id}
                                type="button"
                                className="btn-mini"
                                disabled={bloqueado}
                                onClick={() => entregar(u, it)}
                                title={titulo}
                              >
                                +1 {it.producto}
                              </button>
                            );
                          })}
                      </div>
                      )}
                      {sinPagoConfirmado(u) && u.estado_combo !== 'completado' && (
                        <p className="mt-1 text-right text-[11px] font-semibold text-rose-300">⛔ Sin pago confirmado</p>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lista en tarjetas (solo teléfono) */}
      <div className="space-y-3 md:hidden">
        {cargando ? (
          <p className="panela p-6 text-center text-sm text-slate-500">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="panela p-6 text-center text-sm text-slate-500">No hay usuarios con este filtro.</p>
        ) : (
          filtrados.map((u) => {
            const esStaff = u.rol !== 'usuario';
            const est = estadoPago(u.estado_pago);
            return (
              <article key={u.id} className="panela space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{u.nombre}</p>
                    <p className="truncate text-xs text-slate-500">C.C. {u.cedula}</p>
                    {Number(u.n_acompanantes) > 0 && (
                      <p className="text-[11px] font-semibold text-sky-300">👥 +{u.n_acompanantes} · {u.combo_personas} persona(s)</p>
                    )}
                  </div>
                  {esStaff ? (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      {ETIQUETA_ROL[u.rol] || u.rol}
                    </span>
                  ) : (
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${est.clase}`}>{est.texto}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  👤 Cliente:{' '}
                  <strong className={u.combo_cliente === 'completado' ? 'text-emerald-300' : 'text-amber-300'}>
                    {u.combo_cliente === 'completado' ? '✅' : u.combo_cliente === 'parcial' ? '🟡' : '⏳'}
                  </strong>
                  {u.combo_acompanantes && (
                    <span>
                      {' '}· 👥:{' '}
                      <strong className={u.combo_acompanantes.estado === 'completado' ? 'text-emerald-300' : 'text-amber-300'}>
                        {u.combo_acompanantes.estado === 'completado' ? '✅' : '⏳'}
                      </strong>
                    </span>
                  )}
                  {' '}
                  <span className={u.estado_combo === 'completado' ? 'font-bold text-emerald-300' : 'font-bold text-slate-300'}>
                    · {u.estado_combo === 'completado' ? 'Completado' : u.estado_combo === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </span>
                </p>
                <ul className="space-y-1.5">
                  {(u.combo_items || []).map((it) => {
                    const pct = it.requerido > 0 ? Math.min(100, Math.round((it.entregado / it.requerido) * 100)) : 0;
                    return (
                      <li key={it.inventario_id}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-200">{it.producto}</span>
                          <span className="tabular-nums text-slate-400">{it.entregado}/{it.requerido}</span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-fuchsia-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-col gap-1.5">
                  {u.estado_combo === 'completado' ? (
                    <p className="text-center text-xs font-bold text-emerald-300">✅ Combo entregado</p>
                  ) : (
                  <>
                  {sinPagoConfirmado(u) && (
                    <p className="text-center text-[11px] font-semibold text-rose-300">⛔ Sin pago confirmado: confirma el total antes de entregar</p>
                  )}
                  {(u.combo_items || [])
                    .filter((it) => it.faltante > 0)
                    .map((it) => (
                      <button
                        key={it.inventario_id}
                        type="button"
                        className="btn-mini w-full"
                        disabled={ocupado || stockDe(it.inventario_id) <= 0 || sinPagoConfirmado(u)}
                        onClick={() => entregar(u, it)}
                      >
                        +1 {it.producto} ({it.faltante} faltan)
                      </button>
                    ))}
                  </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

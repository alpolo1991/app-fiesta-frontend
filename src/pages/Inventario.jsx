import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TarjetaKPI from '../components/TarjetaKPI';
import Modal from '../components/Modal';
import { dinero } from '../utils';

const CATEGORIAS = { bebida: '🍺 Bebida', comida: '🍽️ Comida', otro: '📦 Otro' };

/**
 * Vista de inventario (admin y moderador).
 * Tarjetas resumen + tabla de productos + ingreso de stock (admin).
 * Se usa como página /inventario y como pestaña del panel.
 */
export default function Inventario({ alCambiar }) {
  const { usuario } = useAuth();
  const { notificar } = useToast();
  const esAdmin = usuario?.rol === 'admin';

  const [datos, setDatos] = useState({ productos: [], totales: {} });
  const [movimientos, setMovimientos] = useState([]);
  const [mostrarMovs, setMostrarMovs] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ingreso, setIngreso] = useState(null); // producto
  const [cantIngreso, setCantIngreso] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Venta / salida de stock (admin y moderador)
  const [venta, setVenta] = useState(null); // producto
  const [fVenta, setFVenta] = useState({ cantidad: 1, monto: '', montoManual: false, usuario_id: '', motivo: '' });
  const [usuarios, setUsuarios] = useState([]);

  // Alta / edición de productos (solo admin)
  const [editor, setEditor] = useState(null); // null | 'nuevo' | producto
  const [fProd, setFProd] = useState({ producto: '', categoria: 'bebida', cantidad_total: 0, precio_unitario: 0, combo_por_persona: 0 });

  // Ajuste de stock (solo admin): fija disponible/total con motivo
  const [ajuste, setAjuste] = useState(null); // producto
  const [fAjuste, setFAjuste] = useState({ disponible: '', total: '', motivo: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/inventario');
      setDatos(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  const cargarMovimientos = useCallback(async () => {
    try {
      const { data } = await api.get('/inventario/movimientos');
      setMovimientos(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const productos = datos.productos || [];
  const valorStock = productos.reduce((acc, p) => acc + p.cantidad_disponible * p.precio_unitario, 0);
  const combo = productos.filter((p) => Number(p.combo_por_persona) > 0);
  const unidadesCombo = combo.reduce((acc, p) => acc + Number(p.cantidad_disponible || 0), 0);
  const unidadesReservadas = productos.reduce((acc, p) => acc + Number(p.cantidad_reservada || 0), 0);
  const vendido = datos.vendido ?? 0;
  const vendidoHoy = datos.vendido_hoy ?? 0;

  /** Abre el modal de venta para un producto. */
  const abrirVenta = async (p) => {
    setVenta(p);
    setFVenta({ cantidad: 1, monto: p.precio_unitario, montoManual: false, usuario_id: '', motivo: '' });
    if (usuarios.length === 0) {
      try {
        const { data } = await api.get('/usuarios');
        setUsuarios(data);
      } catch (error) {
        notificar(mensajeError(error, 'No se pudieron cargar los usuarios.'), 'error');
      }
    }
  };

  /** Cambia la cantidad y recalcula el monto (si no fue editado a mano). */
  const cambiarCantidadVenta = (valor) => {
    const cant = Number(valor) || 0;
    setFVenta((f) => ({
      ...f,
      cantidad: valor,
      monto: f.montoManual ? f.monto : cant * (venta?.precio_unitario || 0),
    }));
  };

  /** Registra la venta: descuenta stock y acredita el monto en Caja Bebidas. */
  const registrarVenta = async (e) => {
    e.preventDefault();
    const cant = Number(fVenta.cantidad);
    if (!Number.isInteger(cant) || cant < 1) return notificar('Ingresa una cantidad válida (entera mayor a 0).', 'error');
    if (cant > venta.cantidad_disponible) {
      return notificar(`Solo hay ${venta.cantidad_disponible} unidad(es) disponibles.`, 'error');
    }
    const monto = Number(fVenta.monto);
    if (isNaN(monto) || monto < 0) return notificar('Ingresa un monto válido.', 'error');
    if (monto === 0 && !fVenta.motivo.trim()) {
      return notificar('La cortesía ($0) exige un motivo (ej: premio o degustación).', 'error');
    }

    setOcupado(true);
    try {
      const { data } = await api.post(`/inventario/${venta.id}/salida`, {
        cantidad: cant,
        monto,
        usuario_id: fVenta.usuario_id ? Number(fVenta.usuario_id) : undefined,
        motivo: fVenta.motivo.trim() || undefined,
      });
      notificar(data.mensaje, 'exito');
      setVenta(null);
      await cargar();
      if (mostrarMovs) await cargarMovimientos();
      alCambiar?.(); // refresca KPIs del panel (stock y caja de bebidas)
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  /** Registra el ajuste: fija el stock con motivo (sin mover cajas). */
  const registrarAjuste = async (e) => {
    e.preventDefault();
    if (!fAjuste.motivo.trim()) return notificar('El motivo del ajuste es obligatorio.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.post(`/inventario/${ajuste.id}/ajuste`, {
        cantidad_disponible: Number(fAjuste.disponible),
        cantidad_total: fAjuste.total === '' ? undefined : Number(fAjuste.total),
        motivo: fAjuste.motivo.trim(),
      });
      notificar(data.mensaje, 'exito');
      setAjuste(null);
      await cargar();
      if (mostrarMovs) await cargarMovimientos();
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const registrarIngreso = async (e) => {
    e.preventDefault();
    const cantidad = Number(cantIngreso);
    if (isNaN(cantidad) || cantidad <= 0) return notificar('Ingresa una cantidad válida.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.post(`/inventario/${ingreso.id}/ingreso`, {
        cantidad,
        motivo: motivo.trim() || 'Ingreso de stock',
      });
      notificar(data.mensaje, 'exito');
      setIngreso(null);
      setCantIngreso('');
      setMotivo('');
      await cargar();
      if (mostrarMovs) await cargarMovimientos();
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  /** Acciones por producto: en tarjeta van apiladas a ancho completo. */
  const AccionesProd = ({ p, vertical }) => (
    <div className={`flex gap-1.5 ${vertical ? 'flex-col' : 'flex-wrap justify-end'}`}>
      <button
        type="button"
        className={`btn-mini !border-emerald-400/40 !text-emerald-300${vertical ? ' w-full' : ''}`}
        title="Venta / salida de stock (solo admin y moderador)"
        disabled={p.cantidad_disponible <= 0}
        onClick={() => abrirVenta(p)}
      >
        🛒 Vender
      </button>
      {esAdmin && (
        <>
          <button
            type="button"
            className={`btn-mini${vertical ? ' w-full' : ''}`}
            title="Editar producto"
            aria-label={`Editar producto ${p.producto}`}
            onClick={() => {
              setEditor(p);
              setFProd({
                producto: p.producto,
                categoria: p.categoria,
                cantidad_total: p.cantidad_total,
                precio_unitario: p.precio_unitario,
                combo_por_persona: p.combo_por_persona || 0,
              });
            }}
          >
            ✏️ Editar
          </button>
          <button
            type="button"
            className={`btn-mini !border-amber-400/40 !text-amber-300${vertical ? ' w-full' : ''}`}
            title="Ajustar stock (fijar disponible según reservas)"
            aria-label={`Ajustar stock de ${p.producto}`}
            onClick={() => {
              setAjuste(p);
              setFAjuste({ disponible: p.cantidad_disponible, total: p.cantidad_total, motivo: '' });
            }}
          >
            ⚖️ Ajustar
          </button>
        </>
      )}
      <button
        type="button"
        className={`btn-mini${vertical ? ' w-full' : ''}`}
        disabled={!esAdmin}
        title={esAdmin ? 'Registrar ingreso de stock' : 'Solo admin'}
        onClick={() => {
          setIngreso(p);
          setCantIngreso('');
          setMotivo('');
        }}
      >
        ＋ Ingreso
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <TarjetaKPI titulo="Productos" icono="📦" valor={productos.length} subtitulo="referencias distintas" color="cielo" />
        <TarjetaKPI
          titulo="Disponibles"
          icono="🎲"
          valor={datos.totales?.disponibles ?? 0}
          subtitulo={`${datos.totales?.entregados ?? 0} entregados · ${unidadesReservadas} reservados`}
          color="esmeralda"
        />
        <TarjetaKPI
          titulo="Stock combo"
          icono="🎁"
          valor={unidadesCombo}
          subtitulo={`${combo.length} producto(s) · 3 cervezas + 1 comida`}
          color="oro"
        />
        <TarjetaKPI
          titulo="Valor en stock"
          icono="💰"
          valor={dinero(valorStock)}
          subtitulo="disponible × precio"
          color="violeta"
        />
        <TarjetaKPI
          titulo="Vendido"
          icono="💵"
          valor={dinero(vendido)}
          subtitulo={`hoy ${dinero(vendidoHoy)} · va a la Caja de Bebidas`}
          color="esmeralda"
        />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Inventario de productos</h2>
        <div className="flex gap-2">
          {esAdmin && (
            <button
              type="button"
              className="btn-mini !border-amber-400/40 !text-amber-300"
              onClick={() => {
                setEditor('nuevo');
                setFProd({ producto: '', categoria: 'bebida', cantidad_total: 0, precio_unitario: 0, combo_por_persona: 0 });
              }}
            >
              ＋ Nuevo producto
            </button>
          )}
          <button
            type="button"
            className="btn-mini"
            onClick={async () => {
              if (!mostrarMovs) await cargarMovimientos();
              setMostrarMovs((v) => !v);
            }}
          >
            {mostrarMovs ? 'Ver productos' : '📜 Ver movimientos'}
          </button>
        </div>
      </div>

      {/* Tabla productos (tablet y compu) */}
      {!mostrarMovs ? (
        <>
        <div className="panela hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr>
                <th className="th-tabla">Producto</th>
                <th className="th-tabla">Categoría</th>
                <th className="th-tabla">Precio</th>
                <th className="th-tabla">Total</th>
                <th className="th-tabla">Disponible</th>
                <th className="th-tabla">Entregado / Vendido</th>
                <th className="th-tabla text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cargando ? (
                <tr>
                  <td className="td-tabla py-8 text-center text-slate-500" colSpan={7}>
                    Cargando inventario…
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td className="td-tabla py-8 text-center text-slate-500" colSpan={7}>
                    No hay productos.
                  </td>
                </tr>
              ) : (
                productos.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.03]">
                    <td className="td-tabla">
                      <p className="font-semibold text-white">
                        {p.producto}{' '}
                        {Number(p.combo_por_persona) > 0 && (
                          <span className="ml-1 text-xs text-amber-300">· combo ×{p.combo_por_persona}</span>
                        )}
                      </p>
                      {Number(p.cantidad_reservada) > 0 && (
                        <p className="text-[11px] text-sky-300">📦 {p.cantidad_reservada} reservadas</p>
                      )}
                    </td>
                    <td className="td-tabla text-slate-400">{CATEGORIAS[p.categoria] || p.categoria}</td>
                    <td className="td-tabla font-semibold text-slate-200">{dinero(p.precio_unitario)}</td>
                    <td className="td-tabla text-slate-400">{p.cantidad_total}</td>
                    <td className="td-tabla">
                      <span
                        className={`font-bold ${p.cantidad_disponible <= 10 ? 'text-rose-300' : 'text-emerald-300'}`}
                      >
                        {p.cantidad_disponible}
                      </span>
                    </td>
                    <td className="td-tabla text-slate-400">{p.cantidad_entregada}</td>
                    <td className="td-tabla text-right">
                      <AccionesProd p={p} vertical={false} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Tarjetas de productos (solo teléfono) */}
        <div className="space-y-3 md:hidden">
          {cargando ? (
            <p className="panela p-6 text-center text-sm text-slate-500">Cargando inventario…</p>
          ) : productos.length === 0 ? (
            <p className="panela p-6 text-center text-sm text-slate-500">No hay productos.</p>
          ) : (
            productos.map((p) => (
              <article key={p.id} className="panela space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {p.producto}{' '}
                      {Number(p.combo_por_persona) > 0 && (
                        <span className="text-xs text-amber-300">· combo ×{p.combo_por_persona}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{CATEGORIAS[p.categoria] || p.categoria} · {dinero(p.precio_unitario)}</p>
                  </div>
                  <span className={`shrink-0 font-display text-lg font-extrabold tabular-nums ${p.cantidad_disponible <= 10 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {p.cantidad_disponible}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Total {p.cantidad_total} · Entregados {p.cantidad_entregada}
                  {Number(p.cantidad_reservada) > 0 && <span className="text-sky-300"> · 📦 {p.cantidad_reservada} reservadas</span>}
                </p>
                <AccionesProd p={p} vertical />
              </article>
            ))
          )}
        </div>
        </>
      ) : (
        <>
        <div className="panela hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr>
                <th className="th-tabla">Fecha</th>
                <th className="th-tabla">Producto</th>
                <th className="th-tabla">Tipo</th>
                <th className="th-tabla">Cantidad</th>
                <th className="th-tabla">Motivo</th>
                <th className="th-tabla">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {movimientos.length === 0 ? (
                <tr>
                  <td className="td-tabla py-8 text-center text-slate-500" colSpan={6}>
                    Sin movimientos registrados.
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.03]">
                    <td className="td-tabla whitespace-nowrap text-slate-400">{m.created_at}</td>
                    <td className="td-tabla font-semibold text-white">{m.producto}</td>
                    <td className="td-tabla">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          m.tipo === 'ingreso'
                            ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                            : m.tipo === 'reserva' || m.tipo === 'ajuste'
                              ? 'border-sky-400/30 bg-sky-500/15 text-sky-300'
                              : 'border-rose-400/30 bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {m.tipo}
                      </span>
                    </td>
                    <td className="td-tabla font-semibold text-white">{m.cantidad}</td>
                    <td className="td-tabla text-slate-400">{m.motivo}</td>
                    <td className="td-tabla text-slate-400">{m.usuario_nombre || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Tarjetas de movimientos (solo teléfono) */}
        <div className="space-y-2.5 md:hidden">
          {movimientos.length === 0 ? (
            <p className="panela p-6 text-center text-sm text-slate-500">Sin movimientos registrados.</p>
          ) : (
            movimientos.map((m) => (
              <article key={m.id} className="panela space-y-1.5 p-3.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-white">{m.producto}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      m.tipo === 'ingreso'
                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                        : m.tipo === 'reserva' || m.tipo === 'ajuste'
                          ? 'border-sky-400/30 bg-sky-500/15 text-sky-300'
                          : 'border-rose-400/30 bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {m.tipo} ×{m.cantidad}
                  </span>
                </div>
                <p className="break-words text-xs text-slate-400">{m.motivo || '—'}</p>
                <p className="text-[11px] text-slate-500">{m.created_at} · {m.usuario_nombre || '—'}</p>
              </article>
            ))
          )}
        </div>
        </>
      )}

      {/* Modal ingreso */}
      <Modal abierto={!!ingreso} titulo={`Ingreso de stock · ${ingreso?.producto || ''}`} onCerrar={() => setIngreso(null)}>
        <form onSubmit={registrarIngreso} className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            Disponible actual: <strong className="text-emerald-300">{ingreso?.cantidad_disponible}</strong> · Total:{' '}
            <strong>{ingreso?.cantidad_total}</strong>
          </div>
          <div>
            <label className="etiqueta">Cantidad a ingresar</label>
            <input
              type="number"
              className="campo"
              min="1"
              value={cantIngreso}
              onChange={(e) => setCantIngreso(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="etiqueta">Motivo</label>
            <input
              className="campo"
              placeholder="Ej: compra proveedor"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={() => setIngreso(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={ocupado}>
              {ocupado ? 'Registrando…' : 'Registrar ingreso'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal ajuste de stock (solo admin) */}
      <Modal abierto={!!ajuste} titulo={`⚖️ Ajustar stock · ${ajuste?.producto || ''}`} onCerrar={() => setAjuste(null)}>
        <form onSubmit={registrarAjuste} className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            Actual: disponible <strong className="text-emerald-300">{ajuste?.cantidad_disponible}</strong> · total{' '}
            <strong>{ajuste?.cantidad_total}</strong> · entregado <strong>{ajuste?.cantidad_entregada}</strong>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Disponible (nuevo valor)</label>
              <input
                type="number"
                className="campo"
                min="0"
                step="1"
                value={fAjuste.disponible}
                onChange={(e) => setFAjuste((f) => ({ ...f, disponible: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="etiqueta">Total (opcional)</label>
              <input
                type="number"
                className="campo"
                min="0"
                step="1"
                value={fAjuste.total}
                onChange={(e) => setFAjuste((f) => ({ ...f, total: e.target.value }))}
                placeholder="igual o mayor"
              />
            </div>
          </div>
          <div>
            <label className="etiqueta">Motivo (obligatorio)</label>
            <input
              className="campo"
              placeholder="Ej: conteo inicial según reservas"
              maxLength={200}
              value={fAjuste.motivo}
              onChange={(e) => setFAjuste((f) => ({ ...f, motivo: e.target.value }))}
              required
            />
          </div>
          <p className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[11px] leading-relaxed text-sky-200">
            📌 El ajuste fija el stock y queda en el historial. No mueve ninguna caja.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={() => setAjuste(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar ajuste'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal VENTA / salida de stock (admin y moderador) */}
      <Modal abierto={!!venta} titulo={`🛒 Vender · ${venta?.producto || ''}`} onCerrar={() => setVenta(null)}>
        <form onSubmit={registrarVenta} className="space-y-3">
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-sm sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Disponible</p>
              <p className="font-bold text-emerald-300">{venta?.cantidad_disponible}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Precio</p>
              <p className="font-bold text-white">{dinero(venta?.precio_unitario)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Ya salido</p>
              <p className="font-bold text-slate-300">{venta?.cantidad_entregada}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Cantidad a vender</label>
              <input
                type="number"
                className="campo"
                min="1"
                max={venta?.cantidad_disponible}
                value={fVenta.cantidad}
                onChange={(e) => cambiarCantidadVenta(e.target.value)}
                required
                autoFocus
              />
              <p className="mt-1 text-[11px] text-slate-500">Máximo: {venta?.cantidad_disponible}</p>
            </div>
            <div>
              <label className="etiqueta">Monto vendido</label>
              <input
                type="number"
                className="campo"
                min="0"
                step="500"
                value={fVenta.monto}
                onChange={(e) => setFVenta((f) => ({ ...f, monto: e.target.value, montoManual: true }))}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {fVenta.montoManual ? 'Monto manual (editable)' : 'Automático: precio × cantidad'}
              </p>
            </div>
          </div>

          <div>
            <label className="etiqueta">Comprador (opcional)</label>
            <select
              className="campo"
              value={fVenta.usuario_id}
              onChange={(e) => setFVenta((f) => ({ ...f, usuario_id: e.target.value }))}
            >
              <option value="">🛵 Consumidor final (sin asignar)</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} · {u.cedula}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiqueta">Motivo / nota (opcional)</label>
            <input
              className="campo"
              placeholder="Ej: venta en barra"
              value={fVenta.motivo}
              onChange={(e) => setFVenta((f) => ({ ...f, motivo: e.target.value }))}
            />
          </div>

          <p className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[11px] leading-relaxed text-sky-200">
            📌 El stock se descuenta automáticamente y el monto se registra como ingreso en la{' '}
            <strong>Caja de Bebidas</strong>.
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={() => setVenta(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-exito" disabled={ocupado}>
              {ocupado ? 'Registrando…' : '🛒 Registrar venta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal crear / editar producto (admin) */}
      <Modal
        abierto={!!editor}
        titulo={editor === 'nuevo' ? 'Nuevo producto' : `Editar · ${editor?.producto || ''}`}
        onCerrar={() => setEditor(null)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setOcupado(true);
            try {
              if (editor === 'nuevo') {
                const { data } = await api.post('/inventario', fProd);
                notificar(data.mensaje, 'exito');
              } else {
                // Las cantidades no viajan: se ajustan con Ingreso/Ajuste.
                const { cantidad_total, cantidad_disponible, cantidad_entregada, ...soloDatos } = fProd;
                const { data } = await api.put(`/inventario/${editor.id}`, soloDatos);
                notificar(data.mensaje, 'exito');
              }
              setEditor(null);
              await cargar();
              alCambiar?.();
            } catch (error) {
              notificar(mensajeError(error), 'error');
            } finally {
              setOcupado(false);
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="etiqueta">Nombre del producto</label>
            <input
              className="campo"
              value={fProd.producto}
              onChange={(e) => setFProd((f) => ({ ...f, producto: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Categoría</label>
              <select
                className="campo"
                value={fProd.categoria}
                onChange={(e) => setFProd((f) => ({ ...f, categoria: e.target.value }))}
              >
                <option value="bebida">Bebida</option>
                <option value="comida">Comida</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="etiqueta">Precio unitario</label>
              <input
                type="number"
                className="campo"
                min="0"
                step="500"
                value={fProd.precio_unitario}
                onChange={(e) => setFProd((f) => ({ ...f, precio_unitario: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Cantidad total</label>
              <input
                type="number"
                className="campo"
                min="0"
                value={fProd.cantidad_total}
                onChange={(e) => setFProd((f) => ({ ...f, cantidad_total: e.target.value }))}
                disabled={editor !== 'nuevo'}
                title={editor !== 'nuevo' ? 'Usa "+ Ingreso" para sumar stock' : ''}
              />
            </div>
            <div>
              <label className="etiqueta">Combo por persona (0 = no es combo)</label>
              <input
                type="number"
                className="campo"
                min="0"
                max="100"
                step="1"
                value={fProd.combo_por_persona}
                onChange={(e) => setFProd((f) => ({ ...f, combo_por_persona: e.target.value }))}
              />
              <p className="mt-1 text-[11px] text-slate-500">Ej: Cerveza 3 · Comida, Torta y Gaseosa 1.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

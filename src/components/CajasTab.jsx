import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { dinero, fechaLegible } from '../utils';

const META = {
  inscripcion: { titulo: '💰 Caja de Inscripción', color: 'border-amber-400/30', texto: 'text-amber-300', nota: 'Cupo de la fiesta ($50.000)' },
  bebidas: { titulo: '🥤 Caja de Bebidas', color: 'border-violet-400/30', texto: 'text-violet-300', nota: 'Ventas de bebidas y extras' },
};

/**
 * Pestaña de cajas (SOLO admin): dos cajas separadas, movimientos e
 * ingreso/egreso manual. Sin cierre: todo queda abierto y auditado.
 * Nunca se suman en una sola cifra.
 */
export default function CajasTab() {
  const { notificar } = useToast();
  const [cajas, setCajas] = useState([]);
  const [movimientos, setMovimientos] = useState({}); // {tipo: []}
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({ tipo: 'inscripcion', movimiento: 'ingreso', concepto: '', monto: '' });
  const [verTodo, setVerTodo] = useState({}); // {tipo: bool}
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, i, b] = await Promise.all([
        api.get('/cajas'),
        api.get('/cajas/inscripcion/movimientos'),
        api.get('/cajas/bebidas/movimientos'),
      ]);
      setCajas(c.data);
      setMovimientos({ inscripcion: i.data.movimientos, bebidas: b.data.movimientos });
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const registrar = async (e) => {
    e.preventDefault();
    const monto = Number(form.monto);
    if (isNaN(monto) || monto <= 0) return notificar('Ingresa un monto válido.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.post(`/cajas/${form.tipo}/movimiento`, {
        tipo: form.movimiento,
        concepto: form.concepto,
        monto,
      });
      notificar(data.mensaje, 'exito');
      setForm((f) => ({ ...f, concepto: '', monto: '' }));
      await cargar();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  if (cargando) return <div className="panela p-8 text-center text-sm text-slate-500">Cargando cajas…</div>;

  return (
    <div className="space-y-5">
      {/* ====== Las dos cajas por separado ====== */}
      <div className="grid gap-4 lg:grid-cols-2">
        {cajas.map((caja) => {
          const meta = META[caja.tipo] || { titulo: caja.tipo, color: 'border-white/10', texto: 'text-white', nota: '' };
          const lista = movimientos[caja.tipo] || [];
          return (
            <section key={caja.id} className={`panela p-5 ${meta.color}`}>
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-white">{meta.titulo}</h3>
                  <p className="text-xs text-slate-500">{meta.nota}</p>
                </div>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-300">
                  Abierta
                </span>
              </header>

              <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Ingresos</p>
                  <p className={`font-display text-sm font-extrabold ${meta.texto}`}>{dinero(caja.ingresos)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Egresos</p>
                  <p className="font-display text-sm font-extrabold text-rose-300">{dinero(caja.egresos)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo</p>
                  <p className={`font-display text-sm font-extrabold ${meta.texto}`}>{dinero(caja.saldo)}</p>
                </div>
              </div>

              {/* Movimientos */}
              <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02]">
                {lista.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500">Sin movimientos.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {(verTodo[caja.tipo] ? lista : lista.slice(0, 15)).map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="min-w-0">
                          <span className="block truncate text-slate-300">{m.concepto}</span>
                          <span className="text-slate-500">{fechaLegible(m.created_at)}</span>
                        </span>
                        <span className={`shrink-0 font-bold ${m.tipo === 'ingreso' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {m.tipo === 'ingreso' ? '+' : '−'}
                          {dinero(m.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {lista.length > 15 && (
                <button
                  type="button"
                  className="btn-mini mt-2 w-full"
                  onClick={() => setVerTodo((v) => ({ ...v, [caja.tipo]: !v[caja.tipo] }))}
                >
                  {verTodo[caja.tipo] ? `Ver menos (${lista.length})` : `Ver todos (${lista.length})`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {/* ====== Registrar movimiento manual ====== */}
      <section className="panela p-5">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-slate-400">
          Registrar movimiento manual
        </h3>
        <form onSubmit={registrar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="etiqueta">Caja</label>
            <select className="campo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="inscripcion">Inscripción</option>
              <option value="bebidas">Bebidas</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Tipo</label>
            <select
              className="campo"
              value={form.movimiento}
              onChange={(e) => setForm((f) => ({ ...f, movimiento: e.target.value }))}
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="etiqueta">Concepto</label>
            <input
              className="campo"
              placeholder="Ej: compra de hielo"
              value={form.concepto}
              onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className="etiqueta">Monto</label>
            <input
              type="number"
              className="campo"
              min="1"
              max="100000000"
              step="1000"
              value={form.monto}
              onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5 lg:flex lg:justify-end">
            <button type="submit" className="btn-oro w-full lg:w-auto" disabled={ocupado}>
              {ocupado ? 'Registrando…' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

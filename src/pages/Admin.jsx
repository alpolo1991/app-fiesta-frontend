import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import CajasTab from '../components/CajasTab';
import ConfigTab from '../components/ConfigTab';
import CuentasPagoTab from '../components/CuentasPagoTab';
import Entregas from '../pages/Entregas';
import Inventario from '../pages/Inventario';
import PreguntasCRUD from '../components/PreguntasCRUD';
import SoportesPendientes from '../components/SoportesPendientes';
import SolicitudesRecuperacion from '../components/SolicitudesRecuperacion';
import TarjetaKPI from '../components/TarjetaKPI';
import UsuariosTab from '../components/UsuariosTab';
import VerEncuestas from '../components/VerEncuestas';
import { dinero } from '../utils';

const TABS = [
  { v: 'usuarios', t: '👥 Usuarios' },
  { v: 'soportes', t: '🧾 Soportes' },
  { v: 'entregas', t: '🎁 Entregas' },
  { v: 'inventario', t: '📦 Inventario' },
  { v: 'encuestas', t: '📋 Encuestas' },
  { v: 'preguntas', t: '❓ Preguntas' },
  { v: 'cajas', t: '💰 Cajas' },
  { v: 'cuentas', t: '🏦 Cuentas de pago' },
  { v: 'config', t: '⚙️ Configuración' },
];

/** Panel de administración: 8 tarjetas KPI + pestañas de gestión. */
export default function Admin() {
  const { notificar } = useToast();
  const [resumen, setResumen] = useState(null);
  const [tab, setTab] = useState('usuarios');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/resumen');
      setResumen(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const r = resumen || {};
  const ins = r.cajaInscripcion || {};
  const beb = r.cajaBebidas || {};
  const per = r.personal || {};

  return (
    <div className="space-y-6">
      {/* ================= Encabezado ================= */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Panel de control</p>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Administración 🎉</h1>
        </div>
        <button type="button" className="btn-mini" onClick={cargar}>
          🔄 Actualizar
        </button>
      </div>

      {/* ============ 12 tarjetas KPI ============ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <TarjetaKPI
          titulo="Pago total"
          icono="💎"
          valor={cargando ? '…' : dinero(r.ganancias?.total)}
          subtitulo={`Inscripción ${dinero(r.ganancias?.cajaInscripcion)} · Bebidas ${dinero(r.ganancias?.cajaBebidas)}`}
          color="oro"
        />
        <TarjetaKPI
          titulo="Personal"
          icono="👥"
          valor={cargando ? '…' : per.total ?? 0}
          subtitulo={`${per.usuarios ?? 0} usuarios + ${per.acompanantes ?? 0} acompañante(s)`}
          color="cielo"
        />
        <TarjetaKPI
          titulo="Equipo"
          icono="🛡️"
          valor={cargando ? '…' : (r.equipo?.admins ?? 0) + (r.equipo?.moderadores ?? 0)}
          subtitulo={`${r.equipo?.admins ?? 0} admin · ${r.equipo?.moderadores ?? 0} mod`}
          color="cielo"
        />
        <TarjetaKPI
          titulo="Caja Inscripción"
          icono="💰"
          valor={cargando ? '…' : dinero(ins.saldo)}
          subtitulo={`Ingresos ${dinero(ins.ingresos)} · Egresos ${dinero(ins.egresos)}`}
          color="oro"
        />
        <TarjetaKPI
          titulo="Caja Bebidas"
          icono="💰"
          valor={cargando ? '…' : dinero(beb.saldo)}
          subtitulo={`Ingresos ${dinero(beb.ingresos)} · Egresos ${dinero(beb.egresos)}`}
          color="violeta"
        />
        <TarjetaKPI
          titulo="Por cobrar"
          icono="📊"
          valor={cargando ? '…' : dinero(per.porCobrar)}
          subtitulo={`Recaudado ${dinero(per.recaudado)} · Acompañantes ${dinero(r.acompanantes?.total ?? 0)}`}
          color="rose"
        />
        <TarjetaKPI
          titulo="Pagados"
          icono="✅"
          valor={cargando ? '…' : per.pagados ?? 0}
          subtitulo={`${r.ganancias?.inscripcionesConfirmadas ?? 0} confirmadas · ${r.ganancias?.acompanantesConfirmados ?? 0} acompañante(s)`}
          color="esmeralda"
        />
        <TarjetaKPI
          titulo="Abonos"
          icono="🟡"
          valor={cargando ? '…' : per.abonados ?? 0}
          subtitulo={`${r.soportesPendientes ?? 0} soporte(s) por validar`}
          color="oro"
        />
        <TarjetaKPI
          titulo="Stock bebidas"
          icono="🍺"
          valor={cargando ? '…' : r.stock?.bebidas ?? 0}
          subtitulo="unidades disponibles"
          color="cielo"
        />
        <TarjetaKPI
          titulo="Stock comidas"
          icono="🍽️"
          valor={cargando ? '…' : r.stock?.comidas ?? 0}
          subtitulo="unidades disponibles"
          color="esmeralda"
        />
        <TarjetaKPI
          titulo="Acompañante pago confirmado"
          icono="💞"
          valor={cargando ? '…' : dinero(r.ganancias?.montoAcompanantes)}
          subtitulo={`${r.ganancias?.acompanantesConfirmados ?? 0} confirmado(s) · en caja`}
          color="esmeralda"
        />
        <TarjetaKPI
          titulo="Acompañante por cobrar"
          icono="⏳"
          valor={cargando ? '…' : dinero(r.ganancias?.montoAcompanantesPorCobrar)}
          subtitulo={`${r.ganancias?.acompanantesPorCobrar ?? 0} pendiente(s) · suma en Por cobrar`}
          color="rose"
        />
      </div>

      {/* Aviso de cajas separadas */}
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center text-xs text-slate-400">
        ℹ️ La <strong className="text-slate-300">Caja de Inscripción</strong> y la{' '}
        <strong className="text-slate-300">Caja de Bebidas</strong> se llevan por separado y nunca se suman.
      </p>

      {/* Solicitudes de recuperación pendientes */}
      <SolicitudesRecuperacion alCambiar={cargar} />

      {/* ================= Pestañas ================= */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {TABS.map((t) => (
          <button key={t.v} type="button" className={`tab ${tab === t.v ? 'tab-activa' : ''}`} onClick={() => setTab(t.v)}>
            {t.t}
          </button>
        ))}
      </div>

      <div className="anim-entrada">
        {tab === 'usuarios' && <UsuariosTab modo="admin" alCambiar={cargar} />}
        {tab === 'soportes' && <SoportesPendientes alCambiar={cargar} />}
        {tab === 'entregas' && <Entregas alCambiar={cargar} />}
        {tab === 'inventario' && <Inventario alCambiar={cargar} />}
        {tab === 'encuestas' && <VerEncuestas />}
        {tab === 'preguntas' && <PreguntasCRUD />}
        {tab === 'cajas' && <CajasTab />}
        {tab === 'cuentas' && <CuentasPagoTab />}
        {tab === 'config' && <ConfigTab />}
      </div>
    </div>
  );
}

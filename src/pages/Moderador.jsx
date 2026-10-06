import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import Entregas from '../pages/Entregas';
import SoportesPendientes from '../components/SoportesPendientes';
import SolicitudesRecuperacion from '../components/SolicitudesRecuperacion';
import TarjetaKPI from '../components/TarjetaKPI';
import UsuariosTab from '../components/UsuariosTab';
import VerEncuestas from '../components/VerEncuestas';

const TABS = [
  { v: 'soportes', t: '🧾 Soportes pendientes' },
  { v: 'entregas', t: '🎁 Entregas' },
  { v: 'usuarios', t: '👥 Usuarios' },
  { v: 'encuestas', t: '📋 Ver encuestas' },
];

/**
 * Panel del moderador: mismos KPIs pero SIN montos de dinero,
 * validación de soportes, entregas, encuestas y reset de contraseñas.
 */
export default function Moderador() {
  const { notificar } = useToast();
  const [resumen, setResumen] = useState(null);
  const [tab, setTab] = useState('soportes');
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
  const per = r.personal || {};

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Zona de moderación</p>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Panel moderador 🧑‍⚖️</h1>
        </div>
        <button type="button" className="btn-mini" onClick={cargar}>
          🔄 Actualizar
        </button>
      </div>

      {/* 9 KPIs sin montos de dinero */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKPI titulo="Personal" icono="👥" valor={cargando ? '…' : per.total ?? 0} subtitulo={`${per.usuarios ?? 0} usuarios + ${per.acompanantes ?? 0} acompañante(s)`} color="cielo" />
        <TarjetaKPI
          titulo="Equipo"
          icono="🛡️"
          valor={cargando ? '…' : (r.equipo?.admins ?? 0) + (r.equipo?.moderadores ?? 0)}
          subtitulo={`${r.equipo?.admins ?? 0} admin · ${r.equipo?.moderadores ?? 0} mod`}
          color="cielo"
        />
        <TarjetaKPI titulo="Pagados" icono="✅" valor={cargando ? '…' : per.pagados ?? 0} subtitulo={`${r.ganancias?.inscripcionesConfirmadas ?? 0} confirmadas · ${r.ganancias?.acompanantesConfirmados ?? 0} acompañante(s)`} color="esmeralda" />
        <TarjetaKPI titulo="Abonos" icono="🟡" valor={cargando ? '…' : per.abonados ?? 0} subtitulo="con abono parcial" color="oro" />
        <TarjetaKPI
          titulo="Soportes"
          icono="🧾"
          valor={cargando ? '…' : r.soportesPendientes ?? 0}
          subtitulo="pendientes de validar"
          color="rose"
        />
        <TarjetaKPI titulo="Stock bebidas" icono="🍺" valor={cargando ? '…' : r.stock?.bebidas ?? 0} subtitulo="disponibles" color="cielo" />
        <TarjetaKPI titulo="Stock comidas" icono="🍽️" valor={cargando ? '…' : r.stock?.comidas ?? 0} subtitulo="disponibles" color="violeta" />
        <TarjetaKPI
          titulo="Combos"
          icono="🎁"
          valor={cargando ? '…' : `${r.combos?.completados ?? 0}/${(r.combos?.completados ?? 0) + (r.combos?.pendientes ?? 0)}`}
          subtitulo={`usuarios · staff ${r.combosStaff?.completados ?? 0}/${r.combosStaff?.total ?? 0}`}
          color="esmeralda"
        />
        <TarjetaKPI
          titulo="Encuestas"
          icono="📋"
          valor={cargando ? '…' : r.encuestas?.completadas ?? 0}
          subtitulo={`${r.encuestas?.pendientes ?? 0} pendientes · ${r.acompanantes?.cantidad ?? 0} con acompañante`}
          color="oro"
        />
      </div>

      {/* Solicitudes de recuperación pendientes */}
      <SolicitudesRecuperacion alCambiar={cargar} />

      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {TABS.map((t) => (
          <button key={t.v} type="button" className={`tab ${tab === t.v ? 'tab-activa' : ''}`} onClick={() => setTab(t.v)}>
            {t.t}
          </button>
        ))}
      </div>

      <div className="anim-entrada">
        {tab === 'soportes' && <SoportesPendientes alCambiar={cargar} />}
        {tab === 'entregas' && <Entregas alCambiar={cargar} />}
        {tab === 'usuarios' && <UsuariosTab modo="moderador" alCambiar={cargar} />}
        {tab === 'encuestas' && <VerEncuestas />}
      </div>
    </div>
  );
}

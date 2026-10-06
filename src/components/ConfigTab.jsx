import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';

const CLAVES = [
  { clave: 'nombre_admin', etiqueta: '👤 Nombre del administrador (contacto)', tipo: 'texto' },
  { clave: 'whatsapp_admin', etiqueta: '📱 WhatsApp del administrador', tipo: 'tel' },
  { clave: 'nombre_moderador', etiqueta: '👤 Nombre del moderador (contacto)', tipo: 'texto' },
  { clave: 'whatsapp_moderador', etiqueta: '📱 WhatsApp del moderador', tipo: 'tel' },
  { clave: 'monto_acompanante', etiqueta: '👥 Monto fijo por acompañante', tipo: 'monto' },
  { clave: 'monto_inscripcion', etiqueta: '🎟️ Monto de inscripción por usuario', tipo: 'monto' },
  { clave: 'nombre_evento', etiqueta: '🎉 Nombre del evento', tipo: 'texto' },
  { clave: 'lugar_evento', etiqueta: '📍 Lugar del evento', tipo: 'texto' },
  { clave: 'fecha_evento', etiqueta: '📅 Fecha de la fiesta', tipo: 'fecha' },
  { clave: 'hora_evento', etiqueta: '🕗 Hora inicial de la fiesta', tipo: 'hora' },
];

const TIPO_INPUT = { tel: 'tel', monto: 'number', fecha: 'date', hora: 'time', texto: 'text' };

/**
 * Pestaña de configuración (SOLO admin): WhatsApp de admin/moderador
 * y datos del evento. Cada clave se guarda con PUT /api/configuracion/:clave.
 */
export default function ConfigTab() {
  const { notificar } = useToast();
  const [valores, setValores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/configuracion');
      setValores(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (clave, silencioso) => {
    if (clave === 'monto_acompanante' || clave === 'monto_inscripcion') {
      const n = Number(valores[clave]);
      if (isNaN(n) || n <= 0) {
        if (!silencioso) notificar('El monto debe ser mayor a 0.', 'error');
        return false;
      }
    }
    if (clave === 'whatsapp_admin' || clave === 'whatsapp_moderador') {
      const w = String(valores[clave] ?? '').replace(/\D/g, '');
      if (w && !/^\d{7,15}$/.test(w)) {
        if (!silencioso) notificar('El WhatsApp debe tener solo dígitos (7 a 15).', 'error');
        return false;
      }
    }
    if ((clave === 'nombre_admin' || clave === 'nombre_moderador') && String(valores[clave] ?? '').trim().length > 80) {
      if (!silencioso) notificar('El nombre no puede superar 80 caracteres.', 'error');
      return false;
    }
    if (clave === 'hora_evento' && valores[clave] && !/^\d{2}:\d{2}$/.test(String(valores[clave]))) {
      if (!silencioso) notificar('La hora debe tener formato HH:MM.', 'error');
      return false;
    }
    setGuardando(clave);
    try {
      const { data } = await api.put(`/configuracion/${clave}`, { valor: valores[clave] ?? '' });
      if (!silencioso) notificar(data.mensaje, 'exito');
      return true;
    } catch (error) {
      notificar(mensajeError(error), 'error');
      return false;
    } finally {
      setGuardando(null);
    }
  };

  const guardarTodo = async () => {
    for (const c of CLAVES) {
      const ok = await guardar(c.clave, true);
      if (!ok) return notificar(`Revisa el campo "${c.etiqueta}".`, 'error');
    }
    notificar('Configuración guardada.', 'exito');
  };

  if (cargando) return <div className="panela p-8 text-center text-sm text-slate-500">Cargando configuración…</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Contactos y evento para <strong className="text-slate-200">/soporte</strong>,{' '}
        <strong className="text-slate-200">/recuperar</strong> y la{' '}
        <strong className="text-slate-200">cuenta regresiva</strong> (login + banner). Los montos de inscripción y
        acompañante se aplican a nuevos saldos y acompañantes. Sin fecha no hay cuenta regresiva.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {CLAVES.map((c) => (
          <section key={c.clave} className="panela p-4">
            <label className="etiqueta">{c.etiqueta}</label>
            <div className="flex gap-2">
              <input
                type={TIPO_INPUT[c.tipo] || 'text'}
                className="campo"
                min={c.tipo === 'monto' ? 1000 : undefined}
                step={c.tipo === 'monto' ? 1000 : undefined}
                maxLength={c.tipo === 'tel' ? 15 : c.clave.startsWith('nombre_') ? 80 : undefined}
                value={valores[c.clave] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                placeholder={
                  c.tipo === 'tel'
                    ? '3001234567'
                    : c.tipo === 'monto'
                      ? '50000'
                      : c.tipo === 'hora'
                        ? '19:00'
                        : c.clave.startsWith('nombre_')
                          ? 'Nombre y apellido'
                          : 'Valor'
                }
              />
              <button
                type="button"
                className="btn-oro shrink-0"
                onClick={() => guardar(c.clave)}
                disabled={guardando === c.clave}
              >
                {guardando === c.clave ? '…' : 'Guardar'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Clave: {c.clave}</p>
          </section>
        ))}
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-fantasma" onClick={guardarTodo} disabled={!!guardando}>
          💾 Guardar todo
        </button>
      </div>
    </div>
  );
}

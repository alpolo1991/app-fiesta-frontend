import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { copiarTexto, fechaLegible, bloqueEventoWhatsApp } from '../utils';
import Modal from './Modal';

/** Número colombiano normalizado para wa.me. */
function numeroWhatsApp(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('57') && d.length >= 12 ? d : `57${d}`;
}

/**
 * Solicitudes de recuperación de contraseña (admin y moderador).
 * Banner con contador + lista (nombre, correo, fecha) y botón de reset
 * rápido: genera la temporal y la muestra con Copiar + Enviar por WhatsApp.
 * Al resetear, la solicitud se marca atendida sola.
 */
export default function SolicitudesRecuperacion({ alCambiar }) {
  const { notificar } = useToast();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reset, setReset] = useState(null); // {usuario, password}
  const [ocupado, setOcupado] = useState(false);
  const [config, setConfig] = useState({});

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/recuperaciones');
      setSolicitudes(data.solicitudes || []);
    } catch (error) {
      // Sin permiso o sin solicitudes: no se muestra nada.
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data || {}))
      .catch(() => {});
  }, [cargar]);

  /** Genera la temporal y abre el modal con opciones de envío. */
  const resetearYEnviar = async (s) => {
    setOcupado(true);
    try {
      const { data } = await api.put(`/usuarios/${s.usuario_id}/reset-password`);
      setReset({ usuario: data.usuario, password: data.password_temporal });
      notificar(data.mensaje, 'exito');
      await cargar();
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  // El modal va separado del banner: si se ocultara con la lista,
  // desaparecería justo al atender la solicitud.
  const sinPendientes = !cargando && solicitudes.length === 0;

  const wa = reset ? numeroWhatsApp(reset.usuario.whatsapp) : '';

  return (
    <>
      {!sinPendientes && (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
        <p className="text-sm font-bold text-amber-200">
          🔑 {solicitudes.length} solicitud(es) de recuperación pendientes
        </p>
        <ul className="mt-2 space-y-2">
          {solicitudes.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
            >
              <span className="min-w-0 text-sm">
                <strong className="text-white">{s.usuario_nombre}</strong>{' '}
                <span className="break-all text-slate-400">· {s.usuario_email || '—'} · {fechaLegible(s.created_at)}</span>
              </span>
              <button
                type="button"
                className="btn-oro shrink-0"
                disabled={ocupado}
                onClick={() => resetearYEnviar(s)}
                title="Genera la clave temporal y muestra cómo enviarla"
              >
                {ocupado ? '…' : '🔑 Resetear y enviar'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
      )}

      {/* Modal: clave generada + formas de envío (siempre montado) */}
      <Modal abierto={!!reset} titulo="Clave temporal generada" onCerrar={() => setReset(null)}>
        {reset && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-amber-300">
                Clave temporal de {reset.usuario.nombre}{reset.usuario.email ? ` (${reset.usuario.email})` : ''}
              </p>
              <p className="mt-2 font-mono text-2xl font-extrabold tracking-[0.2em] text-white">{reset.password}</p>
              <p className="mt-1 text-[11px] text-slate-400">Deberá cambiarla al ingresar · solo se muestra una vez</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-fantasma"
                onClick={async () => {
                  const ok = await copiarTexto(reset.password);
                  notificar(ok ? 'Clave copiada.' : 'No se pudo copiar.', ok ? 'exito' : 'error');
                }}
              >
                📋 Copiar clave
              </button>
              {wa ? (
                <a
                  className="btn-exito"
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(
                    `Hola ${reset.usuario.nombre}, tu clave temporal es: ${reset.password}. Cámbiala al ingresar.\n\n${bloqueEventoWhatsApp(config)}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 Enviar por WhatsApp
                </a>
              ) : (
                <button type="button" className="btn-oro opacity-50" disabled title="Sin WhatsApp registrado">
                  💬 Sin WhatsApp
                </button>
              )}
              <button type="button" className="btn-fantasma" onClick={() => setReset(null)}>
                Listo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

import { useEffect, useState } from 'react';
import api from '../api/client';
import AvisoPagos from '../components/AvisoPagos';
import { bloqueEventoWhatsApp } from '../utils';

/**
 * Página de soporte (versión simple, SIN tickets de soporte - fase 2).
 * Dos botones grandes de WhatsApp + información del evento.
 */
export default function Soporte() {
  const [config, setConfig] = useState({});
  const [contactos, setContactos] = useState(null); // null = cargando

  useEffect(() => {
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data))
      .catch(() => {});
    // Staff real (todo admin/mod con WhatsApp aparece solo).
    api
      .get('/configuracion/contactos')
      .then((r) => setContactos(r.data))
      .catch(() => setContactos([]));
  }, []);

  const normalizarWa = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (!d) return '';
    return d.startsWith('57') && d.length >= 12 ? d : `57${d}`;
  };
  const waAdmin = normalizarWa(config.whatsapp_admin) || '573133506369';
  const waMod = normalizarWa(config.whatsapp_moderador) || '573133506369';
  const waAdminCorto = config.whatsapp_admin || '3133506369';
  const waModCorto = config.whatsapp_moderador || '3133506369';
  const nombreAdmin = config.nombre_admin || 'Administrador';
  const nombreMod = config.nombre_moderador || 'Moderador';
  const texto = encodeURIComponent(
    `Hola, necesito ayuda con la Fiesta Fin de Año 2026.\n\n${bloqueEventoWhatsApp(config)}`
  );

  // Contactos dinámicos del staff; si aún cargan o no hay, se usan los de configuración.
  const tarjetas =
    contactos && contactos.length > 0
      ? contactos.map((c) => ({
          nombre: c.nombre,
          rol: c.rol === 'admin' ? 'Administrador' : 'Moderador',
          corto: c.whatsapp,
          wa: c.wa,
          verde: c.rol === 'admin',
        }))
      : [
          { nombre: nombreAdmin, rol: 'Administrador', corto: waAdminCorto, wa: waAdmin, verde: true },
          { nombre: nombreMod, rol: 'Moderador', corto: waModCorto, wa: waMod, verde: false },
        ];

  const fechaHora = config.fecha_evento
    ? `${config.fecha_evento}${config.hora_evento ? ` · ${config.hora_evento}` : ''}`
    : 'Por definir';

  const datos = [
    { icono: '🎉', etiqueta: 'Evento', valor: config.nombre_evento || 'Fiesta Fin de Año 2026' },
    { icono: '📍', etiqueta: 'Lugar', valor: config.lugar_evento || 'Por definir' },
    { icono: '🏠', etiqueta: 'Dirección', valor: config.direccion_evento || 'Por definir' },
    { icono: '📅', etiqueta: 'Fecha y hora', valor: fechaHora },
    { icono: '🎟️', etiqueta: 'Cupo', valor: '$50.000 (abono mínimo $20.000)' },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl py-4">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 text-3xl shadow-lg shadow-fuchsia-500/20">
          💬
        </span>
        <h1 className="text-2xl font-extrabold text-white">Ayuda y soporte</h1>
        <p className="mt-1 text-sm text-slate-400">Estamos a un mensaje de distancia</p>
      </div>

      {(config.fecha_abono || config.fecha_limite_pago) && (
        <div className="mb-6">
          <AvisoPagos config={config} />
        </div>
      )}

      {/* Botones grandes de WhatsApp (staff real o configuración) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tarjetas.map((t) => (
          <a
            key={`${t.rol}-${t.corto}`}
            href={`https://wa.me/${t.wa}?text=${texto}`}
            target="_blank"
            rel="noreferrer"
            className={`panela group flex items-center gap-4 p-5 transition ${
              t.verde
                ? 'border-emerald-400/30 hover:border-emerald-400/60 hover:bg-emerald-500/10'
                : 'border-sky-400/30 hover:border-sky-400/60 hover:bg-sky-500/10'
            }`}
          >
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${
                t.verde ? 'bg-emerald-500/15' : 'bg-sky-500/15'
              }`}
            >
              📱
            </span>
            <span>
              <span className="block font-display text-lg font-bold text-white">{t.nombre}</span>
              <span className="block text-sm text-slate-400">
                WhatsApp {t.rol} · {t.corto}
              </span>
              <span className={`mt-1 block text-xs font-semibold ${t.verde ? 'text-emerald-400' : 'text-sky-400'}`}>
                Escríbenos ahora →
              </span>
            </span>
          </a>
        ))}
      </div>

      {/* Información del evento */}
      <div className="panela mt-6 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Información del evento</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {datos.map((d) => (
            <div key={d.etiqueta} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="text-xl" aria-hidden>
                {d.icono}
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {d.etiqueta}
                </span>
                <span className="block text-sm font-semibold text-slate-200">{d.valor}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
        📌 Para reportar un problema, escríbenos por WhatsApp. Nuestro equipo te responderá lo antes posible.
      </p>
    </div>
  );
}

/** Utilidades compartidas del frontend. */

/** Formatea montos en pesos colombianos: 50000 → "$50.000" */
export const dinero = (valor) =>
  `$${Number(valor || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/** Etiqueta y color del badge de estado de pago. */
export const ESTADOS_PAGO = {
  pagado: { texto: 'Pagado', clase: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', icono: '✅' },
  abonado: { texto: 'Abonado', clase: 'bg-amber-500/15 text-amber-300 border-amber-400/30', icono: '🟡' },
  no_pago: { texto: 'Sin pago', clase: 'bg-rose-500/15 text-rose-300 border-rose-400/30', icono: '⛔' },
};

export const estadoPago = (estado) => ESTADOS_PAGO[estado] || ESTADOS_PAGO.no_pago;

/** Badges de estado de soporte. */
export const ESTADOS_SOPORTE = {
  pendiente: { texto: 'Pendiente', clase: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  aprobado: { texto: 'Aprobado', clase: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  rechazado: { texto: 'Rechazado', clase: 'bg-rose-500/15 text-rose-300 border-rose-400/30' },
};

/** Etiqueta legible de los tipos de cuenta de pago. */
export const CUENTAS_TIPO = {
  daviplata: 'Daviplata',
  nequi: 'Nequi',
  'bre-b': 'Bre-B',
};

/** Copia texto al portapapeles y devuelve si tuvo éxito. */
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (e) {
    /* fallback abajo */
  }
  // Fallback (http local / navegadores sin permisos)
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

/** Fecha legible en hora de Colombia: la BD guarda UTC, se muestra en America/Bogota. */
export function fechaLegible(valor) {
  if (!valor) return '—';
  const texto = String(valor).trim().replace(' ', 'T');
  // SQLite entrega "YYYY-MM-DD HH:MM:SS" sin zona (UTC): se marca como Z.
  // Si ya trae zona, se respeta.
  const conZona = /([Zz]|[+-]\d{2}:?\d{2})$/.test(texto) ? texto : `${texto}Z`;
  const fecha = new Date(conZona);
  if (isNaN(fecha)) return String(valor);
  return fecha.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Bloque de datos del evento para mensajes de WhatsApp: siempre lleva
 * nombre, dirección, fecha/hora y enlace de la app. Se arma con la
 * configuración pública; si algo no está definido usa un texto neutro.
 */
export function bloqueEventoWhatsApp(config = {}) {
  const nombre = config.nombre_evento || 'Fiesta Fin de Año 2026';
  const lugar = config.lugar_evento || 'Por definir';
  const direccion = String(config.direccion_evento || '').trim();
  const fecha = String(config.fecha_evento || '').trim();
  const hora = String(config.hora_evento || '').trim();
  const cuando = fecha ? `${fecha}${hora ? ` · ${hora}` : ''}` : 'Fecha por definir';
  const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const lineas = [`🎉 ${nombre}`, `📍 Lugar: ${lugar}`];
  if (direccion && direccion.toLowerCase() !== 'por definir') lineas.push(`🏠 Dirección: ${direccion}`);
  lineas.push(`📅 Fecha: ${cuando}`);
  if (base) lineas.push(`🔗 Ingresa aquí: ${base}/login`);
  return lineas.join('\n');
}

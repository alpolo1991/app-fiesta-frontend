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

/** Fecha legible: 2026-10-04 12:00 → 4 oct 2026, 12:00 */
export function fechaLegible(valor) {
  if (!valor) return '—';
  const fecha = new Date(String(valor).replace(' ', 'T'));
  if (isNaN(fecha)) return String(valor);
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

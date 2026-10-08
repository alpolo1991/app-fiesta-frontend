/** Fecha YYYY-MM-DD → "1 dic" (fecha sola, sin zona horaria). */
function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Aviso informativo de pagos (NO bloquea nada).
 * Muestra fecha de abono y/o límite de pago si el admin las configuró;
 * sin fechas no renderiza nada.
 */
export default function AvisoPagos({ config = {} }) {
  const abono = fechaCorta(config.fecha_abono);
  const limite = fechaCorta(config.fecha_limite_pago);
  if (!abono && !limite) return null;

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm leading-relaxed text-amber-100">
      {abono && limite ? (
        <>
          💰 <strong className="text-amber-300">Abonos abiertos desde el {abono}</strong> · fecha límite{' '}
          <strong className="tabular-nums text-amber-300">{limite}</strong> — ¡separa tu cupo, no te quedes sin
          disfrutar la fiesta! 🎉
        </>
      ) : limite ? (
        <>
          ⏳ <strong className="text-amber-300">Fecha límite de abono: {limite}</strong> — ¡separa tu cupo, no te
          quedes sin disfrutar la fiesta! 🎉
        </>
      ) : (
        <>
          💰 <strong className="text-amber-300">Abonos abiertos desde el {abono}</strong> — ¡separa tu cupo! 🎟️
        </>
      )}
    </div>
  );
}

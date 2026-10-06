import { useEffect, useState } from 'react';

/** ¿El valor de configuración es una fecha válida YYYY-MM-DD? */
export function fechaValida(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) && !isNaN(new Date(`${fecha}T00:00:00`).getTime());
}

/** Segundos restantes hasta fecha+hora (hora "HH:MM", default 19:00). */
function segundosRestantes(fecha, hora) {
  const h = /^\d{2}:\d{2}$/.test(String(hora || '')) ? hora : '19:00';
  const objetivo = new Date(`${fecha}T${h}:00`).getTime();
  if (isNaN(objetivo)) return null;
  return Math.floor((objetivo - Date.now()) / 1000);
}

function partes(seg) {
  const dias = Math.floor(seg / 86400);
  const horas = Math.floor((seg % 86400) / 3600);
  const mins = Math.floor((seg % 3600) / 60);
  const segs = seg % 60;
  return [
    { v: dias, t: 'días' },
    { v: horas, t: 'hrs' },
    { v: mins, t: 'min' },
    { v: segs, t: 'seg' },
  ];
}

/**
 * Cuenta regresiva a la fiesta.
 * Props: fecha (YYYY-MM-DD), hora (HH:MM), nombre, compacto (banner) o bloque.
 * Sin fecha válida no renderiza nada (el admin la define en Configuración).
 *
 * Intent: que todos vean cuánto falta sin entrar al panel; tono festivo
 * contenido: números tabulares, acento dorado, sin robar protagonismo.
 */
export default function CuentaRegresiva({ fecha, hora, nombre, compacto }) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!fechaValida(fecha)) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, hora]);

  if (!fechaValida(fecha)) return null;
  const seg = segundosRestantes(fecha, hora);
  if (seg === null) return null;
  // La hora llegó: mensaje de celebración en vez de ceros.
  if (seg <= 0) {
    return (
      <div className={compacto ? 'text-xs font-bold text-amber-300' : 'panela p-5 text-center'}>
        🎉 ¡{nombre || 'La fiesta'} es hoy! Nos vemos a las {hora || '19:00'} 🥳
      </div>
    );
  }

  const items = partes(seg);
  void ahora;

  if (compacto) {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-amber-400/20 bg-amber-500/[0.07] px-4 py-1.5 text-xs">
        <span aria-hidden>⏳</span>
        <span className="font-semibold text-amber-200">
          {nombre || 'La fiesta'} en{' '}
          <strong className="tabular-nums">
            {items[0].v}d : {String(items[1].v).padStart(2, '0')}h : {String(items[2].v).padStart(2, '0')}m :{' '}
            {String(items[3].v).padStart(2, '0')}s
          </strong>
        </span>
      </div>
    );
  }

  return (
    <div className="panela border-amber-400/25 p-5 text-center">
      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">⏳ Cuenta regresiva</p>
      <p className="mt-1 font-display text-base font-bold text-white">{nombre || 'Fiesta Fin de Año'}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.t} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
            <p className="font-display text-xl font-extrabold tabular-nums text-amber-300 sm:text-2xl">
              {String(i.v).padStart(2, '0')}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{i.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

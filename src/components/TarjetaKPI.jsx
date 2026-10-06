/**
 * TarjetaKPI - componente reutilizable de indicadores.
 * Props: titulo, icono, valor, subtitulo, color ('oro'|'violeta'|'esmeralda'|'rose'|'cielo')
 */
const PALETAS = {
  oro: { fondo: 'from-amber-400/20 to-amber-500/5', borde: 'border-amber-400/30', texto: 'text-amber-300', punto: 'bg-amber-400' },
  violeta: { fondo: 'from-violet-400/20 to-violet-500/5', borde: 'border-violet-400/30', texto: 'text-violet-300', punto: 'bg-violet-400' },
  esmeralda: { fondo: 'from-emerald-400/20 to-emerald-500/5', borde: 'border-emerald-400/30', texto: 'text-emerald-300', punto: 'bg-emerald-400' },
  rose: { fondo: 'from-rose-400/20 to-rose-500/5', borde: 'border-rose-400/30', texto: 'text-rose-300', punto: 'bg-rose-400' },
  cielo: { fondo: 'from-sky-400/20 to-sky-500/5', borde: 'border-sky-400/30', texto: 'text-sky-300', punto: 'bg-sky-400' },
};

export default function TarjetaKPI({ titulo, icono = '📊', valor, subtitulo, color = 'oro' }) {
  const p = PALETAS[color] || PALETAS.oro;

  return (
    <div className={`panela relative overflow-hidden p-4 ${p.borde}`}>
      {/* Destello de fondo */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${p.fondo} opacity-60`} aria-hidden />

      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{titulo}</p>
        <span className="text-lg leading-none" aria-hidden>
          {icono}
        </span>
      </div>

      <p className={`relative mt-2 font-display text-2xl font-extrabold leading-none ${p.texto}`}>{valor}</p>

      {subtitulo && <p className="relative mt-1.5 text-xs text-slate-400">{subtitulo}</p>}

      <span className={`absolute bottom-0 left-4 h-0.5 w-10 rounded-full ${p.punto}`} aria-hidden />
    </div>
  );
}

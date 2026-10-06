import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal reutilizable.
 * Props: abierto, titulo, onCerrar, children, ancho ('md'|'lg'|'xl')
 */
export default function Modal({ abierto, titulo, onCerrar, children, ancho = 'md' }) {
  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const manejar = (e) => e.key === 'Escape' && onCerrar?.();
    window.addEventListener('keydown', manejar);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', manejar);
      document.body.style.overflow = '';
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const anchos = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className={`anim-estallido panela my-6 w-full ${anchos[ancho] || anchos.md} border-white/15`}>
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-bold text-slate-100">{titulo}</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar ventana"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

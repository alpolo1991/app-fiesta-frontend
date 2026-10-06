import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Sistema de toasts (notificaciones flotantes).
 * Uso: const { notificar } = useToast(); notificar('Guardado', 'exito');
 */
const ToastContext = createContext(null);

const ICONOS = { exito: '✅', error: '⚠️', info: 'ℹ️' };
const COLORES = {
  exito: 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100',
  error: 'border-rose-400/40 bg-rose-950/90 text-rose-100',
  info: 'border-sky-400/40 bg-sky-950/90 text-sky-100',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notificar = useCallback((mensaje, tipo = 'exito', duracion = 3800) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duracion);
  }, []);

  const valor = useMemo(() => ({ notificar }), [notificar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {/* Contenedor de toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-entrada pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md ${
              COLORES[t.tipo] || COLORES.info
            }`}
          >
            <span aria-hidden>{ICONOS[t.tipo] || ICONOS.info}</span>
            <span className="pt-0.5">{t.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

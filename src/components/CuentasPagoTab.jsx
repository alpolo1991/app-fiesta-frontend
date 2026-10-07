import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError, obtenerUrlImagen } from '../api/client';
import { useToast } from '../context/ToastContext';
import { CUENTAS_TIPO } from '../utils';

/**
 * Pestaña de cuentas de pago (SOLO admin).
 * Edita número, titular, orden y estado activo de
 * Daviplata / Nequi / Bre-B.
 */
export default function CuentasPagoTab() {
  const { notificar } = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [qrUrls, setQrUrls] = useState({}); // {cuenta_id: objectURL}
  // Tamaño máx configurado por el admin (MB, default 1).
  const [maxMB, setMaxMB] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [{ data }, cfg] = await Promise.all([
        api.get('/cuentas-pago', { params: { todas: 1 } }),
        api.get('/configuracion').catch(() => ({ data: {} })),
      ]);
      setCuentas(data);
      const n = Number(cfg.data?.tamano_max_imagen_mb);
      if (!isNaN(n) && n > 0 && n <= 3) setMaxMB(n);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (id, campo, valor) =>
    setCuentas((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));

  /** Carga la imagen QR de una cuenta para previsualizarla. */
  const verQr = async (cuenta) => {
    if (qrUrls[cuenta.id]) {
      URL.revokeObjectURL(qrUrls[cuenta.id]);
      setQrUrls((prev) => {
        const copia = { ...prev };
        delete copia[cuenta.id];
        return copia;
      });
      return;
    }
    try {
      const url = await obtenerUrlImagen(`/cuentas-pago/${cuenta.id}/qr`);
      setQrUrls((prev) => ({ ...prev, [cuenta.id]: url }));
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo cargar el QR.'), 'error');
    }
  };

  /** Sube o cambia el QR de una cuenta (jpg/png/webp, tamaño configurable). */
  const subirQr = async (cuenta, file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return notificar('Solo se permiten imágenes (jpg, png, webp).', 'error');
    }
    if (file.size > maxMB * 1024 * 1024) return notificar(`El QR supera el máximo de ${maxMB} MB.`, 'error');
    const datos = new FormData();
    datos.append('archivo', file);
    setGuardandoId(cuenta.id);
    try {
      const { data } = await api.put(`/cuentas-pago/${cuenta.id}/qr`, datos);
      notificar(data.mensaje, 'exito');
      setCuentas((prev) => prev.map((c) => (c.id === cuenta.id ? { ...c, ...data.cuenta } : c)));
      setQrUrls((prev) => {
        if (prev[cuenta.id]) URL.revokeObjectURL(prev[cuenta.id]);
        const copia = { ...prev };
        delete copia[cuenta.id];
        return copia;
      });
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setGuardandoId(null);
    }
  };

  /** Quita el QR de una cuenta. */
  const quitarQr = async (cuenta) => {
    if (!window.confirm(`¿Quitar el QR de ${CUENTAS_TIPO[cuenta.tipo] || cuenta.tipo}?`)) return;
    setGuardandoId(cuenta.id);
    try {
      const { data } = await api.delete(`/cuentas-pago/${cuenta.id}/qr`);
      notificar(data.mensaje, 'exito');
      setCuentas((prev) => prev.map((c) => (c.id === cuenta.id ? { ...c, ...data.cuenta } : c)));
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setGuardandoId(null);
    }
  };

  const guardar = async (cuenta) => {
    if (!cuenta.numero.trim() || !cuenta.titular.trim()) {
      return notificar('El número y el titular son obligatorios.', 'error');
    }
    setGuardandoId(cuenta.id);
    try {
      const { data } = await api.put(`/cuentas-pago/${cuenta.id}`, {
        numero: cuenta.numero,
        titular: cuenta.titular,
        activa: cuenta.activa,
        orden: cuenta.orden,
      });
      notificar(data.mensaje, 'exito');
      setCuentas((prev) => prev.map((c) => (c.id === cuenta.id ? { ...c, ...data.cuenta } : c)));
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setGuardandoId(null);
    }
  };

  if (cargando) return <div className="panela p-8 text-center text-sm text-slate-500">Cargando cuentas…</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Estas son las cuentas que ven los usuarios en el botón <strong className="text-slate-200">Pagar / Abonar</strong>.
        Solo el admin puede modificarlas.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        {cuentas.map((c) => (
          <section key={c.id} className="panela p-4">
            <header className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                {CUENTAS_TIPO[c.tipo] || c.tipo}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-emerald-400"
                  checked={!!c.activa}
                  onChange={(e) => cambiar(c.id, 'activa', e.target.checked ? 1 : 0)}
                />
                Activa
              </label>
            </header>

            <div className="space-y-3">
              <div>
                <label className="etiqueta">Número</label>
                <input
                  className="campo font-mono"
                  value={c.numero}
                  onChange={(e) => cambiar(c.id, 'numero', e.target.value)}
                />
              </div>
              <div>
                <label className="etiqueta">Titular</label>
                <input
                  className="campo"
                  value={c.titular}
                  onChange={(e) => cambiar(c.id, 'titular', e.target.value)}
                />
              </div>
              <div>
                <label className="etiqueta">Orden</label>
                <input
                  type="number"
                  className="campo"
                  min="1"
                  value={c.orden ?? ''}
                  onChange={(e) => cambiar(c.id, 'orden', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>

              <div>
                <span className="etiqueta">QR para pagar por QR</span>
                {c.tiene_qr ? (
                  <div className="space-y-2">
                    {qrUrls[c.id] ? (
                      <img src={qrUrls[c.id]} alt={`QR de ${CUENTAS_TIPO[c.tipo] || c.tipo}`} className="mx-auto h-36 w-36 rounded-xl border border-white/10 bg-white object-contain p-1" />
                    ) : (
                      <button type="button" className="btn-mini w-full" onClick={() => verQr(c)}>
                        📷 Ver QR
                      </button>
                    )}
                    <div className="flex gap-2">
                      <label className="btn-mini flex-1 cursor-pointer text-center">
                        🔄 Cambiar
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            subirQr(c, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button type="button" className="btn-mini flex-1 !text-rose-300" onClick={() => quitarQr(c)} disabled={guardandoId === c.id}>
                        🗑 Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="btn-mini w-full cursor-pointer text-center">
                    📤 Subir QR
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        subirQr(c, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                className="btn-oro w-full"
                onClick={() => guardar(c)}
                disabled={guardandoId === c.id}
              >
                {guardandoId === c.id ? 'Guardando…' : '💾 Guardar cuenta'}
              </button>
            </div>
          </section>
        ))}
      </div>

      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
        ℹ️ Los cambios aparecen de inmediato en el modal de pago de los usuarios.
      </p>
    </div>
  );
}

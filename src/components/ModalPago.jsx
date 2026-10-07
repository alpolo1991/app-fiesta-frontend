import { useEffect, useState } from 'react';
import api, { mensajeError, obtenerUrlImagen } from '../api/client';
import { useToast } from '../context/ToastContext';
import { CUENTAS_TIPO, copiarTexto, dinero } from '../utils';
import Modal from './Modal';

const MIME_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Modal de pago: muestra las cuentas (Daviplata, Nequi, Bre-B) con
 * copy-to-clipboard y el formulario para subir soporte de pago.
 */
export default function ModalPago({ abierto, onCerrar, usuario, onEnviado }) {
  const { notificar } = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState('abono');
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cuentasListas, setCuentasListas] = useState(false);
  const [qrUrls, setQrUrls] = useState({}); // {cuenta_id: objectURL}
  // Tamaño máx configurado por el admin (MB, default 1).
  const [maxMB, setMaxMB] = useState(1);
  const maxArchivo = maxMB * 1024 * 1024;
  const etiquetaMax = `${maxMB} MB`;

  const saldo = Number(usuario?.saldo_pendiente ?? 0);
  const yaPagado = saldo <= 0;

  // Cargar cuentas de pago
  useEffect(() => {
    if (!abierto) {
      setQrUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
      return;
    }
    setCuentasListas(false);
    api
      .get('/cuentas-pago')
      .then((r) => setCuentas(r.data))
      .catch(() => notificar('No se pudieron cargar las cuentas de pago.', 'error'))
      .finally(() => setCuentasListas(true));
    api
      .get('/configuracion')
      .then((r) => {
        const n = Number(r.data?.tamano_max_imagen_mb);
        if (!isNaN(n) && n >= 0.5 && n <= 3) setMaxMB(n);
      })
      .catch(() => {});
  }, [abierto, notificar]);

  // Al elegir "pago total" el monto es exactamente el saldo
  useEffect(() => {
    if (tipo === 'pago_total') setMonto(String(saldo));
    else if (monto === String(saldo)) setMonto('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, saldo]);

  const minimoAbono = Math.min(20000, saldo);

  const copiar = async (numero) => {
    const ok = await copiarTexto(numero);
    notificar(ok ? '¡Número copiado!' : 'No se pudo copiar, copia el número manualmente.', ok ? 'exito' : 'error');
  };

  /** Muestra/oculta el QR de una cuenta para pagar por QR. */
  const alternarQr = async (cuenta) => {
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

  const elegirArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return setArchivo(null);
    if (!MIME_VALIDOS.includes(file.type)) {
      e.target.value = '';
      return notificar('Solo se permiten imágenes (jpg, png, webp).', 'error');
    }
    if (file.size > maxArchivo) {
      e.target.value = '';
      return notificar(`La imagen supera el máximo de ${etiquetaMax}.`, 'error');
    }
    setArchivo(file);
  };

  const enviar = async (e) => {
    e.preventDefault();
    const montoNum = Number(monto);

    if (!archivo) return notificar('Adjunta la imagen del soporte de pago.', 'error');
    if (tipo === 'abono' && (isNaN(montoNum) || montoNum < minimoAbono)) {
      return notificar(`El abono mínimo es ${dinero(minimoAbono)}.`, 'error');
    }
    if (tipo === 'abono' && montoNum > saldo) return notificar('El monto supera tu saldo pendiente.', 'error');

    const datos = new FormData();
    datos.append('archivo', archivo);
    datos.append('monto', tipo === 'pago_total' ? saldo : montoNum);
    datos.append('tipo', tipo);

    setCargando(true);
    try {
      const { data } = await api.post('/soportes-pago', datos);
      notificar(data.mensaje, 'exito');
      setArchivo(null);
      setMonto('');
      const input = e.target.querySelector('input[type="file"]');
      if (input) input.value = '';
      onEnviado?.();
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo subir el soporte.'), 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="💳 Pagar / Abonar" onCerrar={onCerrar} ancho="lg">
      {/* ---------- Cuentas ---------- */}
      <div className="space-y-2.5">
        {!cuentasListas && <p className="text-sm text-slate-400">Cargando cuentas de pago…</p>}
        {cuentasListas && cuentas.length === 0 && (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
            Sin cuentas configuradas. Pide al admin que las registre.
          </p>
        )}
        {cuentas.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                {CUENTAS_TIPO[c.tipo] || c.tipo}
              </p>
              <p className="font-mono text-lg font-bold tracking-wide text-white">{c.numero}</p>
              <p className="truncate text-xs text-slate-400">Titular: {c.titular}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {c.tiene_qr && (
                <button type="button" onClick={() => alternarQr(c)} className="btn-fantasma" aria-label={`Ver QR de ${CUENTAS_TIPO[c.tipo] || c.tipo}`}>
                  {qrUrls[c.id] ? '🙈 Ocultar QR' : '📷 Pagar por QR'}
                </button>
              )}
              <button type="button" onClick={() => copiar(c.numero)} className="btn-fantasma shrink-0">
                📋 Copiar
              </button>
            </div>
            {qrUrls[c.id] && (
              <div className="w-full text-center">
                <img src={qrUrls[c.id]} alt={`QR de ${CUENTAS_TIPO[c.tipo] || c.tipo}`} className="mx-auto h-48 w-48 rounded-xl border border-white/10 bg-white object-contain p-2" />
                <p className="mt-1 text-[11px] text-slate-500">Escanea con tu app para pagar el cupo</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-sky-200">
        📌 <strong>Copia el número de UNA opción y paga.</strong> Luego sube el soporte aquí abajo para que el admin o
        moderador lo valide.
      </p>

      {yaPagado ? (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-300">
          ✅ Tu cupo está completamente pagado. ¡Nos vemos en la fiesta!
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Tipo</label>
              <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="abono">Abono (mín. {dinero(minimoAbono)})</option>
                <option value="pago_total">Pago total ({dinero(saldo)})</option>
              </select>
            </div>
            <div>
              <label className="etiqueta">Monto reportado</label>
              <input
                type="number"
                className="campo"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                min={tipo === 'abono' ? minimoAbono : 1}
                max={saldo}
                step="1000"
                disabled={tipo === 'pago_total'}
                placeholder={dinero(minimoAbono)}
                required
              />
            </div>
          </div>

          <div>
              <label className="etiqueta">Imagen del soporte (jpg, png o webp · máx {etiquetaMax})</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={elegirArchivo}
              className="block w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2.5 text-sm text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-amber-400/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-200"
              required
            />
            {archivo && (
              <p className="mt-1.5 text-xs text-slate-400">
                📎 {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <button type="submit" className="btn-oro w-full" disabled={cargando}>
            {cargando ? 'Enviando…' : '📤 Enviar soporte de pago'}
          </button>
        </form>
      )}
    </Modal>
  );
}

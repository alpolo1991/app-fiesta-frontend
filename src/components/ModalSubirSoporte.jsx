import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { dinero } from '../utils';
import Modal from './Modal';

const MIME_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Subir soporte de pago POR un usuario (admin y moderador).
 * Queda pendiente igual que si lo hubiera subido él; el flujo de
 * validación/aprobación no cambia. El tamaño máx lo define el admin.
 */
export default function ModalSubirSoporte({ usuario, abierto, onCerrar, onEnviado }) {
  const { notificar } = useToast();
  const [saldo, setSaldo] = useState(null);
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState('abono');
  const [archivo, setArchivo] = useState(null);
  const [maxMB, setMaxMB] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto || !usuario?.id) return;
    setMonto('');
    setArchivo(null);
    setSaldo(null);
    api
      .get(`/usuarios/${usuario.id}`)
      .then((r) => setSaldo(Number(r.data?.usuario?.saldo_pendiente ?? 0)))
      .catch(() => setSaldo(0));
    api
      .get('/configuracion')
      .then((r) => {
        const n = Number(r.data?.tamano_max_imagen_mb);
        if (!isNaN(n) && n > 0 && n <= 3) setMaxMB(n);
      })
      .catch(() => {});
  }, [abierto, usuario?.id]);

  const elegirArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return setArchivo(null);
    if (!MIME_VALIDOS.includes(file.type)) {
      e.target.value = '';
      return notificar('Solo se permiten imágenes (jpg, png, webp).', 'error');
    }
    if (file.size > maxMB * 1024 * 1024) {
      e.target.value = '';
      return notificar(`La imagen supera el máximo de ${maxMB} MB.`, 'error');
    }
    setArchivo(file);
  };

  const minimoAbono = Math.min(20000, saldo);

  const enviar = async (e) => {
    e.preventDefault();
    const montoNum = Number(monto);
    if (!archivo) return notificar('Adjunta la imagen del soporte de pago.', 'error');
    if (tipo === 'abono' && (isNaN(montoNum) || montoNum < minimoAbono)) {
      return notificar(`El abono mínimo es ${dinero(minimoAbono)}.`, 'error');
    }
    if (tipo === 'abono' && (isNaN(montoNum) || montoNum <= 0)) return notificar('Indica el monto reportado.', 'error');

    const datos = new FormData();
    datos.append('archivo', archivo);
    datos.append('monto', tipo === 'pago_total' ? saldo : montoNum);
    datos.append('tipo', tipo);
    datos.append('usuario_id', usuario.id);

    setEnviando(true);
    try {
      const { data } = await api.post('/soportes-pago', datos);
      notificar(data.mensaje || `Soporte subido por ${usuario.nombre}.`, 'exito');
      onEnviado?.();
      onCerrar();
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo subir el soporte.'), 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo={`📤 Soporte por ${usuario?.nombre || 'usuario'}`} onCerrar={onCerrar}>
      {saldo === null ? (
        <p className="py-4 text-center text-sm text-slate-400">Cargando saldo…</p>
      ) : saldo <= 0 ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-300">
          ✅ {usuario?.nombre} no tiene saldo pendiente.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-sm">
            Saldo pendiente de <strong className="text-white">{usuario?.nombre}</strong>:{' '}
            <strong className="tabular-nums text-amber-300">{dinero(saldo)}</strong>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Tipo</label>
              <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="abono">Abono</option>
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
            <label className="etiqueta">Imagen del soporte (jpg, png o webp · máx {maxMB} MB)</label>
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
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={enviando}>
              {enviando ? 'Enviando…' : '📤 Subir soporte'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

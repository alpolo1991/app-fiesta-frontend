import { useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

/**
 * Modal para cambiar la contraseña del usuario logueado.
 * Si la contraseña es temporal no pide la actual.
 */
export default function CambiarPassword({ abierto, onCerrar }) {
  const { usuario, actualizarUsuario } = useAuth();
  const { notificar } = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verClaves, setVerClaves] = useState(false);
  const [cargando, setCargando] = useState(false);

  const esTemporal = !!usuario?.password_temporal;

  const enviar = async (e) => {
    e.preventDefault();
    if (nueva.length < 6 || nueva.length > 72)
      return notificar('La nueva contraseña debe tener entre 6 y 72 caracteres.', 'error');
    if (nueva !== confirmar) return notificar('Las contraseñas no coinciden.', 'error');

    setCargando(true);
    try {
      const { data } = await api.post('/auth/cambiar-password', {
        password_actual: esTemporal ? undefined : actual,
        password_nueva: nueva,
      });
      notificar(data.mensaje, 'exito');
      actualizarUsuario({ password_temporal: 0 });
      setActual('');
      setNueva('');
      setConfirmar('');
      onCerrar();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="Cambiar contraseña" onCerrar={onCerrar}>
      {esTemporal && (
        <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          Tienes una <strong>contraseña temporal</strong>. Debes crear una nueva para continuar con normalidad.
        </p>
      )}
      <form onSubmit={enviar} className="space-y-3">
        {!esTemporal && (
          <div>
            <label className="etiqueta">Contraseña actual</label>
            <input
              type={verClaves ? 'text' : 'password'}
              className="campo"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
              maxLength={72}
              autoComplete="current-password"
            />
          </div>
        )}
        <div>
          <label className="etiqueta">Nueva contraseña</label>
          <input
            type={verClaves ? 'text' : 'password'}
            className="campo"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="etiqueta">Confirmar nueva contraseña</label>
          <input
            type={verClaves ? 'text' : 'password'}
            className="campo"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="accent-amber-400"
            checked={verClaves}
            onChange={(e) => setVerClaves(e.target.checked)}
          />
          Mostrar contraseñas
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn-oro" disabled={cargando}>
            {cargando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

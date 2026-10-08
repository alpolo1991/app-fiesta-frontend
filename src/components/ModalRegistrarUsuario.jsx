import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { bloqueEventoWhatsApp, copiarTexto, dinero } from '../utils';
import Modal from './Modal';

/** Número colombiano normalizado para wa.me. */
function numeroWhatsApp(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('57') && d.length >= 12 ? d : `57${d}`;
}

const VACIO = { nombre: '', cedula: '', email: '', whatsapp: '' };

/**
 * Registro manual de usuarios (admin y moderador).
 * Mismos datos que el registro público, sin pedir clave: el backend genera
 * una temporal (debe cambiarla al ingresar). Al crear muestra la clave una
 * sola vez para compartirla por WhatsApp.
 */
export default function ModalRegistrarUsuario({ abierto, onCerrar, onCreado }) {
  const { notificar } = useToast();
  const [form, setForm] = useState(VACIO);
  const [ocupado, setOcupado] = useState(false);
  const [creado, setCreado] = useState(null); // {usuario, password}
  const [config, setConfig] = useState({});

  useEffect(() => {
    if (!abierto) return;
    setForm(VACIO);
    setCreado(null);
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data || {}))
      .catch(() => {});
  }, [abierto]);

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
  };

  const registrar = async (e) => {
    e.preventDefault();
    const nom = form.nombre.trim();
    const ced = form.cedula.trim();
    const mail = form.email.trim().toLowerCase();
    const w = form.whatsapp.trim().replace(/\D/g, '');
    if (nom.length < 3 || nom.length > 80) return notificar('El nombre debe tener entre 3 y 80 caracteres.', 'error');
    if (ced && !/^\d{6,12}$/.test(ced)) return notificar('La cédula debe tener solo dígitos (6 a 12).', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notificar('El email no es válido.', 'error');
    if (!/^\d{7,15}$/.test(w)) return notificar('El WhatsApp es (OBLIGATORIO): solo dígitos (7 a 15).', 'error');

    setOcupado(true);
    try {
      const { data } = await api.post('/usuarios', {
        nombre: nom,
        cedula: ced,
        email: mail,
        whatsapp: w,
      });
      notificar(data.mensaje, 'exito');
      setCreado({ usuario: data.usuario, password: data.password_temporal });
      onCreado?.(data.usuario);
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo registrar al usuario.'), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const wa = creado ? numeroWhatsApp(creado.usuario.whatsapp) : '';
  const textoWa = creado
    ? encodeURIComponent(
        `Hola ${creado.usuario.nombre}, te registramos en la Fiesta Fin de Año. Tu clave temporal es: ${creado.password}. Cámbiala al ingresar.\n\n${bloqueEventoWhatsApp(config)}`
      )
    : '';

  return (
    <Modal abierto={abierto} titulo="➕ Registrar usuario" onCerrar={onCerrar}>
      {creado ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-emerald-300">
              {creado.usuario.nombre}
            </p>
            <p className="mt-2 font-mono text-2xl font-extrabold tracking-[0.2em] text-white">{creado.password}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Clave temporal · deberá cambiarla al ingresar ·{" "}
              <span className="tabular-nums">saldo {dinero(creado.usuario.saldo_pendiente)}</span> · solo se muestra una vez
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-fantasma"
              onClick={async () => {
                const ok = await copiarTexto(creado.password);
                notificar(ok ? 'Clave copiada.' : 'No se pudo copiar.', ok ? 'exito' : 'error');
              }}
            >
              📋 Copiar
            </button>
            {wa ? (
              <a className="btn-exito" href={`https://wa.me/${wa}?text=${textoWa}`} target="_blank" rel="noreferrer">
                💬 Enviar por WhatsApp
              </a>
            ) : (
              <button type="button" className="btn-oro opacity-50" disabled title="Sin WhatsApp registrado">
                💬 Sin WhatsApp
              </button>
            )}
            <button
              type="button"
              className="btn-oro"
              onClick={() => {
                setCreado(null);
                setForm(VACIO);
              }}
            >
              ➕ Otro
            </button>
            <button type="button" className="btn-fantasma" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={registrar} className="space-y-4">
          <div>
            <label className="etiqueta" htmlFor="nuevo-nombre">Nombre y apellido</label>
            <input
              id="nuevo-nombre"
              className="campo"
              value={form.nombre}
              onChange={cambiar('nombre')}
              placeholder="Ana Pérez"
              minLength={3}
              maxLength={80}
              required
              autoComplete="off"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="nuevo-cedula">Cédula (opcional)</label>
              <input
                id="nuevo-cedula"
                className="campo"
                value={form.cedula}
                onChange={cambiar('cedula')}
                placeholder="1012345678"
                inputMode="numeric"
                minLength={6}
                maxLength={12}
              />
              <p className="mt-1 text-[11px] text-slate-500">Opcional: si no la informas se asigna un código interno.</p>
            </div>
            <div>
              <label className="etiqueta" htmlFor="nuevo-email">Correo electrónico</label>
              <input
                id="nuevo-email"
                type="email"
                className="campo"
                value={form.email}
                onChange={cambiar('email')}
                placeholder="tu.correo@dominio.com"
                maxLength={120}
                required
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="etiqueta" htmlFor="nuevo-wa">WhatsApp (OBLIGATORIO)</label>
            <input
              id="nuevo-wa"
              className="campo"
              value={form.whatsapp}
              onChange={cambiar('whatsapp')}
              placeholder="3001234567"
              inputMode="tel"
              minLength={7}
              maxLength={15}
              required
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Se genera una clave temporal: deberá cambiarla al ingresar.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={ocupado}>
              {ocupado ? 'Registrando…' : '➕ Registrar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

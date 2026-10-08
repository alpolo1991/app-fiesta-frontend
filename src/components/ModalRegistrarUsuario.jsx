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

const VACIO = { nombre: '', cedula: '', email: '', whatsapp: '', password: '', confirmar: '' };

/**
 * Registro manual de usuarios (admin y moderador).
 * Mismos campos y validaciones que el registro público; el creado queda
 * con clave temporal (debe cambiarla al ingresar). Al crear muestra las
 * credenciales una sola vez para compartirlas por WhatsApp.
 */
export default function ModalRegistrarUsuario({ abierto, onCerrar, onCreado }) {
  const { notificar } = useToast();
  const [form, setForm] = useState(VACIO);
  const [verClave, setVerClave] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [creado, setCreado] = useState(null); // {usuario, password}
  const [config, setConfig] = useState({});

  useEffect(() => {
    if (!abierto) return;
    setForm(VACIO);
    setCreado(null);
    setVerClave(false);
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
    if (!/^\d{6,12}$/.test(ced)) return notificar('La cédula debe tener solo dígitos (6 a 12).', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notificar('El email no es válido.', 'error');
    if (!/^\d{7,15}$/.test(w)) return notificar('El WhatsApp es (OBLIGATORIO): solo dígitos (7 a 15).', 'error');
    if (form.password.length < 6 || form.password.length > 72)
      return notificar('La contraseña debe tener entre 6 y 72 caracteres.', 'error');
    if (form.password !== form.confirmar) return notificar('Las contraseñas no coinciden.', 'error');

    setOcupado(true);
    try {
      const { data } = await api.post('/usuarios', {
        nombre: nom,
        cedula: ced,
        email: mail,
        whatsapp: w,
        password: form.password,
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
              {creado.usuario.nombre} · C.C. {creado.usuario.cedula}
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
                const ok = await copiarTexto(`Usuario: ${creado.usuario.email} · Clave: ${creado.password}`);
                notificar(ok ? 'Credenciales copiadas.' : 'No se pudo copiar.', ok ? 'exito' : 'error');
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
              <label className="etiqueta" htmlFor="nuevo-cedula">Cédula</label>
              <input
                id="nuevo-cedula"
                className="campo"
                value={form.cedula}
                onChange={cambiar('cedula')}
                placeholder="1012345678"
                inputMode="numeric"
                minLength={6}
                maxLength={12}
                required
              />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Contraseña</label>
              <input
                type={verClave ? 'text' : 'password'}
                className="campo"
                value={form.password}
                onChange={cambiar('password')}
                minLength={6}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="etiqueta">Confirmar contraseña</label>
              <input
                type={verClave ? 'text' : 'password'}
                className="campo"
                value={form.confirmar}
                onChange={cambiar('confirmar')}
                minLength={6}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" className="accent-amber-400" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} />
            Mostrar contraseñas
          </label>
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

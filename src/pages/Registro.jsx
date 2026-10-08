import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { mensajeError } from '../api/client';
import AvisoPagos from '../components/AvisoPagos';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Registro() {
  const { registrarse } = useAuth();
  const { notificar } = useToast();
  const navegar = useNavigate();

  const [form, setForm] = useState({ nombre: '', cedula: '', email: '', whatsapp: '', password: '', confirmar: '' });
  const [cargando, setCargando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [config, setConfig] = useState({});

  // Fechas informativas de pago (endpoint público).
  useEffect(() => {
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data || {}))
      .catch(() => {});
  }, []);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const nom = form.nombre.trim();
    const ced = form.cedula.trim();
    const mail = form.email.trim().toLowerCase();
    const w = form.whatsapp.trim().replace(/\D/g, '');
    if (nom.length < 3 || nom.length > 80) return notificar('El nombre debe tener entre 3 y 80 caracteres.', 'error');
    if (ced && !/^\d{6,12}$/.test(ced)) return notificar('La cédula debe tener solo dígitos (6 a 12).', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notificar('El email no es válido.', 'error');
    if (!/^\d{7,15}$/.test(w)) return notificar('El WhatsApp es obligatorio: solo dígitos (7 a 15).', 'error');
    if (form.password.length < 6 || form.password.length > 72)
      return notificar('La contraseña debe tener entre 6 y 72 caracteres.', 'error');
    if (form.password !== form.confirmar) return notificar('Las contraseñas no coinciden.', 'error');

    setCargando(true);
    try {
      await registrarse({ nombre: nom, cedula: ced, email: mail, whatsapp: w, password: form.password });
      notificar('¡Cuenta creada! Ya puedes completar tu perfil.', 'exito');
      navegar('/perfil', { replace: true });
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo crear la cuenta.'), 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 py-6">
      <AvisoPagos config={config} />
      <div className="panela p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 text-2xl">
            🎟️
          </span>
          <h1 className="text-xl font-bold text-white">Registro a la fiesta</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cupo total: <strong className="text-amber-300">$50.000</strong> · Abono mínimo: $20.000
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="etiqueta" htmlFor="reg-nombre">Nombre completo</label>
            <input
              id="reg-nombre"
              className="campo"
              value={form.nombre}
              onChange={cambiar('nombre')}
              placeholder="Ana Pérez"
              minLength={3}
              maxLength={80}
              required
              autoComplete="name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="reg-cedula">Cédula (opcional)</label>
              <input
                id="reg-cedula"
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
              <label className="etiqueta" htmlFor="reg-email">Correo electrónico</label>
              <input
                id="reg-email"
                type="email"
                className="campo"
                value={form.email}
                onChange={cambiar('email')}
                placeholder="tu.correo@dominio.com"
                maxLength={120}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="etiqueta" htmlFor="reg-wa">WhatsApp (OBLIGATORIO)</label>
            <input
              id="reg-wa"
              className="campo"
              value={form.whatsapp}
              onChange={cambiar('whatsapp')}
              placeholder="3001234567"
              inputMode="tel"
              minLength={7}
              maxLength={15}
              required
            />
            <p className="mt-1 text-[11px] text-slate-500">Para avisos de pagos, claves y soporte.</p>
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
          <p className="text-[11px] text-slate-500">Entre 6 y 72 caracteres. Los espacios valen.</p>

          <button type="submit" className="btn-oro w-full" disabled={cargando}>
            {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-amber-400 hover:underline">
            Inicia sesión
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          ¿Necesitas ayuda?{' '}
          <Link to="/soporte" className="font-semibold text-emerald-400 hover:underline">
            💬 Escríbenos por WhatsApp
          </Link>
        </p>
      </div>
    </div>
  );
}

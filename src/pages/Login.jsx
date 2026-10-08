import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { mensajeError } from '../api/client';
import { PANEL_POR_ROL, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import CuentaRegresiva from '../components/CuentaRegresiva';
import AvisoPagos from '../components/AvisoPagos';

export default function Login() {
  const { iniciarSesion, usuario } = useAuth();
  const { notificar } = useToast();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [config, setConfig] = useState({});

  // Datos del evento para la cuenta regresiva (endpoint público).
  useEffect(() => {
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data))
      .catch(() => {});
  }, []);

  // Si ya hay sesión, directo al panel
  if (usuario) {
    return <Navigate to={PANEL_POR_ROL[usuario.rol] || '/perfil'} replace />;
  }

  const enviar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const u = await iniciarSesion(email.trim().toLowerCase(), password);
      notificar(`¡Bienvenido/a, ${u.nombre}!`, 'exito');
      const destino = ubicacion.state?.desde || PANEL_POR_ROL[u.rol] || '/perfil';
      navegar(destino, { replace: true });
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo iniciar sesión.'), 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="grid min-h-[70vh] items-center gap-8 py-6 lg:grid-cols-2">
      {/* ---- Presentación ---- */}
      <div className="hidden lg:block">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
          🎊 Evento empresarial
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-tight text-white xl:text-5xl">
          La fiesta de fin de año
          <span className="block bg-gradient-to-r from-amber-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            empieza aquí
          </span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Regístrate, paga tu cupo de <strong className="text-slate-200">$50.000</strong>, sube tu soporte de pago y
          responde la encuesta para que todo esté listo el día del evento.
        </p>
        <div className="mt-6 flex gap-3 text-3xl" aria-hidden>
          <span>🍻</span>
          <span>🎶</span>
          <span>🍔</span>
          <span>💃</span>
          <span>🕺</span>
        </div>
      </div>

      {/* ---- Formulario ---- */}
      <div className="mx-auto w-full max-w-md space-y-4">
        <CuentaRegresiva fecha={config.fecha_evento} hora={config.hora_evento} nombre={config.nombre_evento} />
        <AvisoPagos config={config} />
        <div className="panela p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 text-2xl">
            🎉
          </span>
          <h2 className="text-xl font-bold text-white">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-400">Ingresa con tu correo registrado</p>
        </div>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="etiqueta" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              className="campo"
              placeholder="tu.correo@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type={verClave ? 'text' : 'password'}
              className="campo"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              required
              autoComplete="current-password"
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                className="accent-amber-400"
                checked={verClave}
                onChange={(e) => setVerClave(e.target.checked)}
              />
              Mostrar contraseña
            </label>
          </div>

          <button type="submit" className="btn-oro w-full" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          <Link to="/recuperar" className="text-amber-400 transition hover:text-amber-300 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <span className="text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-violet-400 transition hover:underline">
              Regístrate
            </Link>
          </span>
          <Link to="/soporte" className="text-xs text-emerald-400 transition hover:underline">
            💬 ¿Problemas para entrar? Escríbenos por WhatsApp
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}

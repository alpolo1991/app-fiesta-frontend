import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, PANEL_POR_ROL } from '../context/AuthContext';
import api from '../api/client';
import CambiarPassword from './CambiarPassword';
import CuentaRegresiva from './CuentaRegresiva';

/** Enlaces de navegación según rol. */
const enlacesPorRol = {
  usuario: [
    { a: '/perfil', texto: 'Mi perfil' },
    { a: '/encuesta', texto: 'Encuesta' },
    { a: '/acompanantes', texto: 'Acompañantes' },
    { a: '/soporte', texto: 'Soporte' },
  ],
  moderador: [
    { a: '/moderador', texto: 'Panel' },
    { a: '/entregas', texto: 'Entregas' },
    { a: '/inventario', texto: 'Inventario' },
    { a: '/acompanantes', texto: 'Acompañantes' },
    { a: '/soporte', texto: 'Soporte' },
  ],
  admin: [
    { a: '/admin', texto: 'Panel' },
    { a: '/entregas', texto: 'Entregas' },
    { a: '/inventario', texto: 'Inventario' },
    { a: '/acompanantes', texto: 'Acompañantes' },
    { a: '/soporte', texto: 'Soporte' },
  ],
};

const ETIQUETA_ROL = { admin: 'Administrador', moderador: 'Moderador', usuario: 'Empleado' };

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [config, setConfig] = useState({});

  // Fecha/hora de la fiesta para la cuenta regresiva (endpoint público).
  useEffect(() => {
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data))
      .catch(() => {});
  }, []);

  const enlaces = enlacesPorRol[usuario?.rol] || enlacesPorRol.usuario;

  const salir = () => {
    cerrarSesion();
    navegar('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ======================= Barra superior ======================= */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <Link to={usuario ? PANEL_POR_ROL[usuario.rol] || '/perfil' : '/login'} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-fuchsia-500 text-lg shadow-lg shadow-amber-500/20">
              🎉
            </span>
            <span className="hidden font-display text-sm font-bold leading-tight text-white sm:block">
              Fiesta Fin de Año
              <span className="block text-[10px] font-medium uppercase tracking-widest text-amber-400">2026</span>
            </span>
          </Link>

          {/* Enlaces (desktop) */}
          {usuario && (
            <nav className="hidden items-center gap-1 md:flex">
              {enlaces.map((l) => (
                <NavLink
                  key={l.a}
                  to={l.a}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive ? 'bg-white/10 text-amber-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {l.texto}
                </NavLink>
              ))}
            </nav>
          )}

          {/* Usuario */}
          <div className="flex items-center gap-2">
            {usuario ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold leading-tight text-white">{usuario.nombre}</p>
                  <p className="text-[11px] uppercase tracking-wider text-amber-400/90">{ETIQUETA_ROL[usuario.rol]}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-amber-300">
                  {usuario.nombre?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                <button type="button" onClick={salir} className="btn-mini hidden sm:inline-flex" title="Cerrar sesión">
                  Salir
                </button>
                <button
                  type="button"
                  onClick={() => setMenuAbierto((v) => !v)}
                  className="cursor-pointer rounded-lg p-2 text-slate-300 transition hover:bg-white/10 md:hidden"
                  aria-label="Menú"
                >
                  ☰
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-oro">
                Ingresar
              </Link>
            )}
          </div>
        </div>

        {/* Menú móvil */}
        {usuario && menuAbierto && (
          <nav className="anim-entrada border-t border-white/10 bg-slate-950/95 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {enlaces.map((l) => (
                <NavLink
                  key={l.a}
                  to={l.a}
                  onClick={() => setMenuAbierto(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-semibold ${
                      isActive ? 'bg-white/10 text-amber-300' : 'text-slate-300 hover:bg-white/5'
                    }`
                  }
                >
                  {l.texto}
                </NavLink>
              ))}
              <button type="button" onClick={salir} className="mt-1 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-300 hover:bg-white/5">
                Cerrar sesión
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* ======================= Aviso contraseña temporal ======================= */}
      {usuario?.password_temporal === 1 && (
        <div className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-200">
          Tu contraseña es <strong>temporal</strong>.{' '}
          <button type="button" onClick={() => setCambiandoPassword(true)} className="cursor-pointer font-bold underline">
            Cambiarla ahora
          </button>
        </div>
      )}

      {/* ============ Cuenta regresiva a la fiesta (si hay fecha) ============ */}
      {usuario && (
        <CuentaRegresiva
          fecha={config.fecha_evento}
          hora={config.hora_evento}
          nombre={config.nombre_evento}
          compacto
        />
      )}

      {/* ======================= Contenido ======================= */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 px-4 py-5 text-center text-xs leading-relaxed text-slate-500">
        <span className="font-display text-sm font-bold text-slate-300">🎊 Fiesta Fin de Año 2026</span>
        <span className="mt-0.5 block">
          ¡Asegura tu cupo y nos vemos en la pista! 💃🕺
        </span>
      </footer>

      <CambiarPassword abierto={cambiandoPassword} onCerrar={() => setCambiandoPassword(false)} />
    </div>
  );
}

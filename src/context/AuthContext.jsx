import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

/**
 * Contexto de autenticación: guarda el JWT en localStorage,
 * mantiene el usuario en memoria y expone login/logout/registro.
 */
const AuthContext = createContext(null);

/** Panel al que entra cada rol. */
export const PANEL_POR_ROL = {
  admin: '/admin',
  moderador: '/moderador',
  usuario: '/perfil',
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Restaurar sesión al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get('/usuarios/me')
      .then((r) => setUsuario(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const registrarse = useCallback(async (datos) => {
    const { data } = await api.post('/auth/registro', datos);
    localStorage.setItem('token', data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem('token');
    setUsuario(null);
  }, []);

  /** Actualiza campos del usuario en sesión (tras editar el perfil, etc.). */
  const actualizarUsuario = useCallback((datos) => {
    setUsuario((prev) => ({ ...(prev || {}), ...datos }));
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, registrarse, cerrarSesion, actualizarUsuario, setUsuario }),
    [usuario, cargando, iniciarSesion, registrarse, cerrarSesion, actualizarUsuario]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, PANEL_POR_ROL } from '../context/AuthContext';

/**
 * Guardia de rutas por rol.
 * <RutaProtegida roles={['admin']}>...</RutaProtegida>
 */
export default function RutaProtegida({ roles, children }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" state={{ desde: ubicacion.pathname }} replace />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    // Sin permisos → lo mandamos a su propio panel
    return <Navigate to={PANEL_POR_ROL[usuario.rol] || '/perfil'} replace />;
  }

  return children;
}

import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import { PANEL_POR_ROL, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Registro from './pages/Registro';
import Recuperar from './pages/Recuperar';
import Soporte from './pages/Soporte';
import Perfil from './pages/Perfil';
import Encuesta from './pages/Encuesta';
import Acompanantes from './pages/Acompanantes';
import Admin from './pages/Admin';
import Moderador from './pages/Moderador';
import Inventario from './pages/Inventario';
import Entregas from './pages/Entregas';

/** Raíz: envía al usuario a su panel según rol. */
function Inicio() {
  const { usuario, cargando } = useAuth();
  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={PANEL_POR_ROL[usuario.rol] || '/perfil'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />

        {/* Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/soporte" element={<Soporte />} />

        {/* Cualquier usuario logueado */}
        <Route
          path="/perfil"
          element={
            <RutaProtegida>
              <Perfil />
            </RutaProtegida>
          }
        />
        <Route
          path="/encuesta"
          element={
            <RutaProtegida>
              <Encuesta />
            </RutaProtegida>
          }
        />
        <Route
          path="/acompanantes"
          element={
            <RutaProtegida>
              <Acompanantes />
            </RutaProtegida>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RutaProtegida roles={['admin']}>
              <Admin />
            </RutaProtegida>
          }
        />

        {/* Moderador */}
        <Route
          path="/moderador"
          element={
            <RutaProtegida roles={['moderador']}>
              <Moderador />
            </RutaProtegida>
          }
        />

        {/* Admin y moderador */}
        <Route
          path="/inventario"
          element={
            <RutaProtegida roles={['admin', 'moderador']}>
              <Inventario />
            </RutaProtegida>
          }
        />
        <Route
          path="/entregas"
          element={
            <RutaProtegida roles={['admin', 'moderador']}>
              <Entregas />
            </RutaProtegida>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

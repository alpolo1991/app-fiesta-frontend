import axios from 'axios';

/**
 * Instancia de Axios para toda la aplicación.
 * - Usa /api (proxy de Vite en dev; en prod sirve el mismo dominio).
 * - Adjunta el JWT guardado en localStorage.
 * - En 401 cierra la sesión.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    // Token inválido/expirado → cerrar sesión
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Mensaje legible del error (siempre en español, desde el backend). */
export function mensajeError(error, fallback = 'Ocurrió un error inesperado.') {
  return error?.response?.data?.mensaje || error?.message || fallback;
}

/** Descarga un archivo protegido (CSV, imagen) usando el JWT y el baseURL de la API. */
export async function descargarArchivo(url, nombreArchivo) {
  const respuesta = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement('a');
  enlace.href = href;
  enlace.download = nombreArchivo || 'archivo';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(href);
}

/** Obtiene una imagen protegida y devuelve una URL de objeto (para <img>). */
export async function obtenerUrlImagen(url) {
  const respuesta = await api.get(url, { responseType: 'blob' });
  // Asegura que el blob tenga el tipo de imagen correcto
  const blob = respuesta.data instanceof Blob ? respuesta.data : new Blob([respuesta.data]);
  const tipo = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
  return URL.createObjectURL(new Blob([blob], { type: tipo }));
}

export default api;

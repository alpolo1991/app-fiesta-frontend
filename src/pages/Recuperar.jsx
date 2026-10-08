import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { mensajeError } from '../api/client';
import { bloqueEventoWhatsApp } from '../utils';
import { useToast } from '../context/ToastContext';

/**
 * Recuperación de contraseña: SOLO pide email.
 * Nunca revela si el correo existe; muestra botones de WhatsApp
 * (admin y moderador) leídos de /api/configuracion.
 */
export default function Recuperar() {
  const { notificar } = useToast();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [config, setConfig] = useState({});
  const [contactos, setContactos] = useState(null);

  // Datos del evento + WhatsApp desde la configuración pública
  useEffect(() => {
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data))
      .catch(() => {});
    api
      .get('/configuracion/contactos')
      .then((r) => setContactos(r.data))
      .catch(() => setContactos([]));
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      notificar('Escribe un correo válido.', 'error');
      return;
    }
    setEmail(mail);
    setCargando(true);
    try {
      const { data } = await api.post('/auth/recuperar', { email: mail });
      setMensaje(data.mensaje);
      setEnviado(true);
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo procesar la solicitud.'), 'error');
    } finally {
      setCargando(false);
    }
  };

  /** Normaliza a wa.me: quita +, espacios y evita doble 57. */
  const normalizarWa = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (!d) return '';
    return d.startsWith('57') && d.length >= 12 ? d : `57${d}`;
  };

  const waAdmin = normalizarWa(config.whatsapp_admin) || '573133506369';
  const waMod = normalizarWa(config.whatsapp_moderador) || '573133506369';
  const waAdminCorto = config.whatsapp_admin || '3133506369';
  const waModCorto = config.whatsapp_moderador || '3133506369';
  const nombreAdmin = config.nombre_admin || 'Administrador';
  const nombreMod = config.nombre_moderador || 'Moderador';
  // El cuerpo incluye el email para que el admin sepa a quién resetear.
  const textoWa = encodeURIComponent(
    `Hola, soy ${email || 'empleado'} y necesito recuperar mi contraseña de la Fiesta Fin de Año. Mi correo registrado es: ${email || '(lo escribo por aquí)'}.\n\n${bloqueEventoWhatsApp(config)}`
  );

  // Staff real (todo admin/mod con WhatsApp aparece solo); fallback a configuración.
  const botones =
    contactos && contactos.length > 0
      ? contactos.map((c) => ({
          nombre: c.nombre,
          rol: c.rol === 'admin' ? 'Administrador' : 'Moderador',
          corto: c.whatsapp,
          wa: c.wa,
          verde: c.rol === 'admin',
        }))
      : [
          { nombre: nombreAdmin, rol: 'Administrador', corto: waAdminCorto, wa: waAdmin, verde: true },
          { nombre: nombreMod, rol: 'Moderador', corto: waModCorto, wa: waMod, verde: false },
        ];

  return (
    <div className="mx-auto w-full max-w-2xl py-6">
      <div className="panela p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-sky-500 text-2xl">
            🔑
          </span>
          <h1 className="text-xl font-bold text-white">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-slate-400">Escribe el correo con el que te registraste</p>
        </div>

        {!enviado ? (
          <form onSubmit={enviar} className="mx-auto max-w-md space-y-4">
            <div>
              <label className="etiqueta">Correo electrónico</label>
              <input
                type="email"
                className="campo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@dominio.com"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-oro w-full" disabled={cargando}>
              {cargando ? 'Enviando…' : 'Solicitar contraseña temporal'}
            </button>
          </form>
        ) : (
          <div className="anim-entrada mx-auto max-w-md">
            {/* Mensaje de confirmación (siempre igual por seguridad) */}
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
              <span className="mb-2 block text-3xl" aria-hidden>
                📩
              </span>
              <p className="text-sm font-semibold leading-relaxed text-emerald-200">
                Si tu correo está registrado, el equipo ya fue notificado. Escríbenos
                por WhatsApp para recibir tu clave temporal.
              </p>
            </div>

            <p className="mt-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
              Contacto directo
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {botones.map((b) => (
                <a
                  key={`${b.rol}-${b.corto}`}
                  href={`https://wa.me/${b.wa}?text=${textoWa}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${b.verde ? 'btn-exito' : 'btn-fantasma'} flex-col !px-4 py-5 text-center`}
                >
                  <span className="text-2xl" aria-hidden>
                    📱
                  </span>
                  {b.nombre}
                  <span className="text-xs font-medium opacity-80">
                    WhatsApp · {b.corto}
                  </span>
                </a>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              El mensaje ya incluye tu correo para que el admin te ubique más rápido.
            </p>
            <div className="mt-2 flex items-center justify-center gap-4 text-sm">
              <button type="button" className="btn-mini" onClick={() => setEnviado(false)}>
                Usar otro correo
              </button>
              <Link to="/login" className="text-amber-400 hover:underline">
                ← Volver a iniciar sesión
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

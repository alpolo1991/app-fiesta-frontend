import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError, obtenerUrlImagen } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { copiarTexto, dinero, estadoPago, ESTADOS_SOPORTE, fechaLegible, bloqueEventoWhatsApp } from '../utils';
import Modal from './Modal';
import ModalDatosUsuario from './ModalDatosUsuario';
import ModalRegistrarUsuario from './ModalRegistrarUsuario';
import ModalSubirSoporte from './ModalSubirSoporte';

/** Número colombiano normalizado para wa.me (ej: 3133506369 → 573133506369). */
function numeroWhatsApp(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('57') && d.length >= 12 ? d : `57${d}`;
}

/**
 * Pestaña de usuarios.
 * modo='admin'  → CRUD completo (rol, abono, eliminar, reset)
 * modo='moderador' → solo lectura + resetear contraseña
 */
export default function UsuariosTab({ modo = 'admin', alCambiar }) {
  const { usuario: yo, actualizarUsuario } = useAuth();
  const { notificar } = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  const [reset, setReset] = useState(null); // {usuario, password}
  const [ficha, setFicha] = useState(null); // usuario (modal de datos)
  const [editor, setEditor] = useState(null); // usuario a editar (solo admin)
  const [fEdit, setFEdit] = useState({ nombre: '', cedula: '', email: '', whatsapp: '' });
  const [validar, setValidar] = useState(null); // usuario en modal unificado (solo admin)
  const [montoVal, setMontoVal] = useState('');
  const [soportesVal, setSoportesVal] = useState([]); // soportes del usuario en validación
  const [cargSopVal, setCargSopVal] = useState(false);
  const [visorVal, setVisorVal] = useState(null); // {soporte, url}
  const [rechazoVal, setRechazoVal] = useState(null); // {id, texto}
  const [ocupado, setOcupado] = useState(false);
  const [config, setConfig] = useState({});
  const [registrando, setRegistrando] = useState(false);
  const [subirPara, setSubirPara] = useState(null); // usuario al que se le sube soporte

  const esAdmin = modo === 'admin';

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/usuarios');
      setUsuarios(data);
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
    api
      .get('/configuracion')
      .then((r) => setConfig(r.data || {}))
      .catch(() => {});
  }, [cargar]);

  const filtrados = usuarios.filter((u) => {
    const t = busqueda.toLowerCase().trim();
    if (!t) return true;
    return [u.nombre, u.email, u.cedula, u.rol].some((v) => String(v || '').toLowerCase().includes(t));
  });

  // ---------------- Acciones ----------------
  const resetearPassword = async (u) => {
    setOcupado(true);
    try {
      const { data } = await api.put(`/usuarios/${u.id}/reset-password`);
      setReset({ usuario: data.usuario, password: data.password_temporal });
      notificar(data.mensaje, 'exito');
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const cambiarRol = async (u, rol) => {
    try {
      const { data } = await api.put(`/usuarios/${u.id}/rol`, { rol });
      notificar(data.mensaje, 'exito');
      if (u.id === yo?.id) actualizarUsuario({ rol });
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, rol } : x)));
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
      cargar();
    }
  };

  const eliminar = async (u) => {
    if (!window.confirm(`¿Eliminar definitivamente a "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const { data } = await api.delete(`/usuarios/${u.id}`);
      notificar(data.mensaje, 'exito');
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  };

  /** Botones de fila: en tabla solo icono (no rompe el layout); en móvil texto completo. */
  const Botones = ({ u, esStaffFila, vertical }) => (
    <div className={vertical ? 'flex flex-col gap-1.5' : 'acciones-tabla'}>
      <button
        type="button"
        className={`btn-mini${vertical ? ' w-full' : ''}`}
        onClick={() => setFicha(u)}
        title="Ver ficha completa del usuario"
        aria-label={`Ver ficha de ${u.nombre}`}
      >
        👁{vertical ? ' Ficha' : ''}
      </button>
      <button
        type="button"
        className={`btn-mini${vertical ? ' w-full' : ''}`}
        onClick={() => resetearPassword(u)}
        disabled={ocupado}
        title="Genera una contraseña temporal nueva"
        aria-label={`Resetear contraseña de ${u.nombre}`}
      >
        🔑{vertical ? ' Reset' : ''}
      </button>
      {!esStaffFila && (
        <button
          type="button"
          className={`btn-mini${vertical ? ' w-full' : ''}`}
          onClick={() => setSubirPara(u)}
          title={`Subir soporte de pago por ${u.nombre} (queda pendiente igual)`}
          aria-label={`Subir soporte por ${u.nombre}`}
        >
          📤{vertical ? ' Subir soporte' : ''}
        </button>
      )}
      {esAdmin && (
        <>
          <button
            type="button"
            className={`btn-mini${vertical ? ' w-full' : ''}`}
            onClick={() => abrirEditor(u)}
            title="Editar nombre, cédula, email y WhatsApp"
            aria-label={`Editar datos de ${u.nombre}`}
          >
            ✏️{vertical ? ' Editar' : ''}
          </button>
          {!esStaffFila && (
            <button
              type="button"
              className={`btn-mini${vertical ? ' w-full' : ''}`}
              onClick={() => abrirValidar(u)}
              title="Validar pago, aprobar soportes, abonar o marcar pago completo"
              aria-label={`Validar pago de ${u.nombre}`}
            >
              💳{vertical ? ` ${u.pago_validado ? 'Validado' : 'Validar / Abono'}` : ''}
            </button>
          )}
          <button
            type="button"
            className={`btn-mini !text-rose-300${vertical ? ' w-full' : ''}`}
            onClick={() => eliminar(u)}
            disabled={u.id === yo?.id || Number(u.monto_abonado || 0) > 0}
            title={Number(u.monto_abonado || 0) > 0 ? 'Tiene pagos registrados: no se puede eliminar' : 'Eliminar usuario'}
            aria-label={`Eliminar a ${u.nombre}`}
          >
            🗑{vertical ? ' Eliminar' : ''}
          </button>
        </>
      )}
    </div>
  );

  const validarPago = async (u, nuevo) => {
    try {
      const { data } = await api.put(`/usuarios/${u.id}/validar-pago`, { pago_validado: nuevo });
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...data.usuario } : x)));
      setValidar((v) => (v && v.id === u.id ? { ...v, ...data.usuario } : v));
      notificar(data.mensaje, 'exito');
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  };

  /** Abono desde el modal Validar pago (monto libre, completo o acompañante). */
  const abonarDesdeValidar = async (monto) => {
    if (!validar) return;
    if (isNaN(monto) || monto <= 0) return notificar('Ingresa un monto válido.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.post(`/usuarios/${validar.id}/abono`, { monto });
      notificar(data.mensaje, 'exito');
      setUsuarios((prev) => prev.map((x) => (x.id === validar.id ? { ...x, ...data.usuario } : x)));
      setValidar((v) => (v ? { ...v, ...data.usuario } : v));
      setMontoVal('');
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const pagoCompleto = async () => {
    if (!validar || Number(validar.saldo_pendiente) <= 0) return;
    if (!window.confirm(`¿Registrar el pago completo de ${dinero(validar.saldo_pendiente)} a ${validar.nombre}?`)) return;
    await abonarDesdeValidar(Number(validar.saldo_pendiente));
  };

  /** Abre el modal unificado y carga los soportes reportados por el usuario. */
  const abrirValidar = async (u) => {
    setValidar(u);
    setMontoVal('');
    setRechazoVal(null);
    setCargSopVal(true);
    try {
      const [{ data: sops }, { data: acomp }] = await Promise.all([
        api.get('/soportes-pago', { params: { estado: 'todas', usuario_id: u.id } }),
        api.get('/acompanantes', { params: { usuario_id: u.id } }),
      ]);
      setSoportesVal(sops);
      setValidar((v) => (v ? { ...v, acompanantes_lista: acomp.lista, acompanantes_total: acomp.total } : v));
    } catch (error) {
      notificar(mensajeError(error, 'No se pudieron cargar los soportes.'), 'error');
      setSoportesVal([]);
    } finally {
      setCargSopVal(false);
    }
  };

  const refrescarValidar = async (id) => {
    try {
      const [{ data: sops }, { data: ficha }] = await Promise.all([
        api.get('/soportes-pago', { params: { estado: 'todas', usuario_id: id } }),
        api.get(`/usuarios/${id}`),
      ]);
      setSoportesVal(sops);
      const usu = ficha.usuario || ficha;
      setValidar((v) => (v ? { ...v, ...usuarioPublicoLocal(usu) } : v));
      setUsuarios((prev) => prev.map((x) => (x.id === id ? { ...x, ...usuarioPublicoLocal(usu) } : x)));
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  };

  /** Copia local sin hash: la ficha trae {usuario, ...}, el PUT de abono trae {usuario} plano. */
  function usuarioPublicoLocal(o) {
    if (!o || typeof o !== 'object') return {};
    const { password_hash, ...resto } = o;
    return resto;
  }

  const aprobarSopVal = async (s) => {
    setOcupado(true);
    try {
      const { data } = await api.put(`/soportes-pago/${s.id}/aprobar`, {});
      notificar(data.mensaje, 'exito');
      await refrescarValidar(s.usuario_id);
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const enviarRechazoVal = async (e) => {
    e.preventDefault();
    if (!rechazoVal?.texto.trim()) return notificar('El comentario es obligatorio al rechazar.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.put(`/soportes-pago/${rechazoVal.id}/rechazar`, { comentario: rechazoVal.texto.trim() });
      notificar(data.mensaje, 'exito');
      setRechazoVal(null);
      await refrescarValidar(validar.id);
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const verFotoVal = async (s) => {
    try {
      const url = await obtenerUrlImagen(`/soportes-pago/${s.id}/archivo`);
      setVisorVal({ soporte: s, url });
    } catch (error) {
      notificar(mensajeError(error, 'No se pudo cargar la imagen.'), 'error');
    }
  };

  const abrirEditor = (u) => {
    setEditor(u);
    setFEdit({ nombre: u.nombre || '', cedula: u.cedula || '', email: u.email || '', whatsapp: u.whatsapp || '' });
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    const nom = fEdit.nombre.trim();
    const ced = fEdit.cedula.trim();
    const mail = fEdit.email.trim().toLowerCase();
    const w = fEdit.whatsapp.trim().replace(/\D/g, '');
    if (nom.length < 3 || nom.length > 80) return notificar('El nombre debe tener entre 3 y 80 caracteres.', 'error');
    if (!/^\d{6,12}$/.test(ced)) return notificar('La cédula debe tener solo dígitos (6 a 12).', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notificar('El email no es válido.', 'error');
    if (fEdit.whatsapp.trim() !== '' && !/^\d{7,15}$/.test(w))
      return notificar('El WhatsApp debe tener solo dígitos (7 a 15).', 'error');
    setOcupado(true);
    try {
      const { data } = await api.put(`/usuarios/${editor.id}`, { nombre: nom, cedula: ced, email: mail, whatsapp: w });
      notificar(data.mensaje, 'exito');
      setUsuarios((prev) => prev.map((x) => (x.id === editor.id ? { ...x, ...data.usuario } : x)));
      setEditor(null);
      alCambiar?.();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="sr-only" htmlFor="buscar-usuarios">Buscar usuarios</label>
        <input
          id="buscar-usuarios"
          className="campo max-w-sm"
          placeholder="🔍 Buscar por nombre, cédula, email o rol…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <span className="text-xs text-slate-500">{filtrados.length} usuario(s)</span>
        <button
          type="button"
          className="btn-oro !px-3.5 !py-2 text-xs"
          onClick={() => setRegistrando(true)}
          title="Registrar un usuario manualmente (mismos datos del registro público)"
        >
          ➕ Registrar
        </button>
      </div>

      {/* Tabla (tablet y compu) */}
      <div className="panela hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr>
              <th className="th-tabla">Usuario</th>
              <th className="th-tabla">Cédula</th>
              <th className="th-tabla">Rol</th>
              <th className="th-tabla">Pago</th>
              <th className="th-tabla">Saldo</th>
              <th className="th-tabla">Combo</th>
              <th className="th-tabla text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {cargando ? (
              <tr>
                <td className="td-tabla py-8 text-center text-slate-500" colSpan={7}>
                  Cargando usuarios…
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td className="td-tabla py-8 text-center text-slate-500" colSpan={7}>
                  No se encontraron usuarios.
                </td>
              </tr>
            ) : (
              filtrados.map((u) => {
                const est = estadoPago(u.estado_pago);
                const esStaff = u.rol === 'admin' || u.rol === 'moderador';
                return (
                  <tr key={u.id} className="hover:bg-white/[0.03]">
                    <td className="td-tabla">
                      <p className="font-semibold text-white">{u.nombre}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="td-tabla text-slate-400">{u.cedula}</td>
                    <td className="td-tabla">
                      {esAdmin ? (
                        <select
                          className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 outline-none"
                          value={u.rol}
                          onChange={(e) => cambiarRol(u, e.target.value)}
                          disabled={u.id === yo?.id}
                          title={u.id === yo?.id ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                        >
                          <option value="usuario">Usuario</option>
                          <option value="moderador">Moderador</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-slate-300">{u.rol}</span>
                      )}
                    </td>
                    <td className="td-tabla">
                      {esStaff ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                          Staff sin cargo
                        </span>
                      ) : (
                        <>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${est.clase}`}>
                            {est.texto}
                          </span>
                          {u.pago_validado === 1 && <span className="ml-1 text-xs" title="Pago validado">✔️</span>}
                        </>
                      )}
                    </td>
                    <td className="td-tabla">
                      {esStaff ? (
                        <p className="text-xs text-slate-500">$0 · sin saldo a pagar</p>
                      ) : Number(u.saldo_pendiente || 0) <= 0 && u.estado_pago === 'pagado' ? (
                        <>
                          <p className="font-semibold text-emerald-300">✅ Pagado</p>
                          <p className="text-xs text-emerald-300/70">$0 pendiente</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-white">{dinero(u.monto_abonado)} abonado</p>
                          <p className="text-xs text-amber-300">{dinero(u.saldo_pendiente)} pendiente</p>
                        </>
                      )}
                    </td>
                    <td className="td-tabla">
                      {u.combo_completado ? (
                        <span className="text-xs font-bold text-emerald-300">✅ Completado</span>
                      ) : (
                        <span className="text-xs text-slate-400" title="Ver detalle en Entregas">
                          🎁 {(u.cervezas_entregadas || 0) + (u.comidas_entregadas || 0)} entregados
                          {u.combo_reservado ? ' · 📦' : ''}
                        </span>
                      )}
                    </td>
                    <td className="td-tabla td-acciones">
                      <Botones u={u} esStaffFila={esStaff} vertical={false} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas (solo teléfono) */}
      <div className="space-y-3 md:hidden">
        {cargando ? (
          <p className="panela p-6 text-center text-sm text-slate-500">Cargando usuarios…</p>
        ) : filtrados.length === 0 ? (
          <p className="panela p-6 text-center text-sm text-slate-500">No se encontraron usuarios.</p>
        ) : (
          filtrados.map((u) => {
            const est = estadoPago(u.estado_pago);
            const esStaff = u.rol === 'admin' || u.rol === 'moderador';
            return (
              <article key={u.id} className="panela space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{u.nombre}</p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                    <p className="text-xs text-slate-500">C.C. {u.cedula}</p>
                  </div>
                  {esAdmin ? (
                    <select
                      className="shrink-0 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold text-slate-200 outline-none"
                      value={u.rol}
                      onChange={(e) => cambiarRol(u, e.target.value)}
                      disabled={u.id === yo?.id}
                      aria-label={`Cambiar rol de ${u.nombre}`}
                    >
                      <option value="usuario">Usuario</option>
                      <option value="moderador">Moderador</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300">
                      {u.rol}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {esStaff ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                      Staff sin cargo
                    </span>
                  ) : Number(u.saldo_pendiente || 0) <= 0 && u.estado_pago === 'pagado' ? (
                    <span className="font-semibold text-emerald-300" title={`Pagado total ${dinero(u.monto_abonado)}`}>
                      ✅ Pagado · $0{u.pago_validado === 1 && ' ✔️'}
                    </span>
                  ) : (
                    <>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${est.clase}`}>
                        {est.texto}
                      </span>
                      {u.pago_validado === 1 && <span title="Pago validado">✔️</span>}
                      <span className="text-slate-400">
                        {dinero(u.monto_abonado)} abonado · <strong className="text-amber-300">{dinero(u.saldo_pendiente)} pendiente</strong>
                      </span>
                    </>
                  )}
                  <span className="text-slate-400">
                    {u.combo_completado
                      ? '✅ Combo completo'
                      : `🎁 ${(u.cervezas_entregadas || 0) + (u.comidas_entregadas || 0)} entregados${u.combo_reservado ? ' · 📦' : ''}`}
                  </span>
                </div>
                <Botones u={u} esStaffFila={esStaff} vertical />
              </article>
            );
          })
        )}
      </div>

      {/* ============ Modal: ficha del usuario (estilo WhatsApp) ============ */}
      <ModalDatosUsuario usuario={ficha} onCerrar={() => setFicha(null)} />

      {/* ============ Modal: registro manual ============ */}
      <ModalRegistrarUsuario
        abierto={registrando}
        onCerrar={() => setRegistrando(false)}
        onCreado={() => {
          cargar();
          alCambiar?.();
        }}
      />

      {/* ============ Modal: subir soporte por el usuario ============ */}
      <ModalSubirSoporte
        usuario={subirPara}
        abierto={!!subirPara}
        onCerrar={() => setSubirPara(null)}
        onEnviado={() => {
          cargar();
          alCambiar?.();
          if (validar) abrirValidar(validar);
        }}
      />

      {/* ============ Modal: contraseña temporal ============ */}
      <Modal abierto={!!reset} titulo="Contraseña temporal generada" onCerrar={() => setReset(null)}>
        {reset && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-amber-300">Envíale esta contraseña a {reset.usuario.nombre} por WhatsApp</p>
              <p className="mt-2 font-mono text-2xl font-extrabold tracking-[0.2em] text-white">{reset.password}</p>
            </div>
            <p className="text-xs text-slate-400">
              El usuario deberá cambiarla al ingresar. Cópiala ahora: <strong>solo se muestra una vez</strong>.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-fantasma"
                onClick={async () => {
                  const ok = await copiarTexto(reset.password);
                  notificar(ok ? 'Contraseña copiada.' : 'No se pudo copiar.', ok ? 'exito' : 'error');
                }}
              >
                📋 Copiar
              </button>
              {numeroWhatsApp(reset.usuario.whatsapp) ? (
                <a
                  className="btn-oro"
                  href={`https://wa.me/${numeroWhatsApp(reset.usuario.whatsapp)}?text=${encodeURIComponent(
                    `Hola ${reset.usuario.nombre}, tu clave temporal es: ${reset.password}. Cámbiala al ingresar.\n\n${bloqueEventoWhatsApp(config)}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 Enviar por WhatsApp
                </a>
              ) : (
                <button type="button" className="btn-oro opacity-50" disabled title="Este usuario no tiene WhatsApp registrado">
                  💬 Sin WhatsApp
                </button>
              )}
              <button type="button" className="btn-fantasma" onClick={() => setReset(null)}>
                Entendido
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ Modal: editar datos (solo admin) ============ */}
      <Modal abierto={!!editor} titulo={`Editar usuario · ${editor?.nombre || ''}`} onCerrar={() => setEditor(null)}>
        <form onSubmit={guardarEdicion} className="space-y-3">
          <p className="text-xs text-slate-400">
            El rol se cambia en la tabla y los montos en <strong className="text-slate-200">💰 Abono</strong>. Aquí solo
            datos personales.
          </p>
          <div>
            <label className="etiqueta">Nombre completo</label>
            <input
              className="campo"
              value={fEdit.nombre}
              onChange={(e) => setFEdit((f) => ({ ...f, nombre: e.target.value }))}
              minLength={3}
              maxLength={80}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta">Cédula</label>
              <input
                className="campo"
                value={fEdit.cedula}
                onChange={(e) => setFEdit((f) => ({ ...f, cedula: e.target.value }))}
                inputMode="numeric"
                minLength={6}
                maxLength={12}
                required
              />
            </div>
            <div>
              <label className="etiqueta">WhatsApp</label>
              <input
                className="campo"
                value={fEdit.whatsapp}
                onChange={(e) => setFEdit((f) => ({ ...f, whatsapp: e.target.value }))}
                inputMode="tel"
                maxLength={15}
                placeholder="3001234567"
              />
            </div>
          </div>
          <div>
            <label className="etiqueta">Correo electrónico</label>
            <input
              type="email"
              className="campo"
              value={fEdit.email}
              onChange={(e) => setFEdit((f) => ({ ...f, email: e.target.value }))}
              maxLength={120}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-oro" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============ Modal unificado: validar + soportes + abono (solo admin) ============ */}
      <Modal abierto={!!validar} titulo={`Validar pago · ${validar?.nombre || ''}`} onCerrar={() => {
        if (visorVal?.url) URL.revokeObjectURL(visorVal.url);
        setVisorVal(null);
        setRechazoVal(null);
        setValidar(null);
      }}>
        {validar && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-sm sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
                <p className="font-bold tabular-nums text-white">{dinero(Number(validar.monto_abonado || 0) + Number(validar.saldo_pendiente || 0) || 50000 + Number(validar.acompanantes_total ?? validar.total_acompanantes ?? 0))}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Abonado</p>
                <p className="font-bold tabular-nums text-emerald-300">{dinero(validar.monto_abonado)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo</p>
                <p className="font-bold tabular-nums text-amber-300">{dinero(validar.saldo_pendiente)}</p>
              </div>
            </div>

            {/* Acompañantes (lista + abono rápido del restante) */}
            {(validar.acompanantes_lista || []).length > 0 || Number(validar.n_acompanantes) > 0 ? (
              <div className="space-y-1.5 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2.5 text-sm">
                {(validar.acompanantes_lista || []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-sky-200">
                    <span className="truncate">👥 {a.nombre}</span>
                    <strong className="shrink-0 tabular-nums">{dinero(a.monto)}</strong>
                  </div>
                ))}
                {(() => {
                  const totalA = (validar.acompanantes_lista || []).reduce((acc, a) => acc + Number(a.monto || 0), 0)
                    || Number(validar.total_acompanantes || 0);
                  const restante = Math.max(0, totalA - Math.min(Number(validar.monto_abonado || 0), totalA));
                  return restante > 0 && Number(validar.saldo_pendiente) > 0 ? (
                    <button
                      type="button"
                      className="btn-mini mt-1"
                      disabled={ocupado}
                      onClick={() => abonarDesdeValidar(Math.min(restante, Number(validar.saldo_pendiente)))}
                      title="Abonar lo que falta de los acompañantes"
                    >
                      💰 Abonar acompañantes ({dinero(Math.min(restante, Number(validar.saldo_pendiente)))})
                    </button>
                  ) : (
                    <p className="text-xs text-sky-200/70">Acompañantes al día ✅</p>
                  );
                })()}
              </div>
            ) : null}

            {/* Soportes reportados: aprobar según lo recibido */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  🧾 Soportes reportados
                </h4>
                <button
                  type="button"
                  className="btn-mini"
                  onClick={() => setSubirPara(validar)}
                  title={`Subir soporte por ${validar?.nombre} (queda pendiente igual)`}
                >
                  📤 Subir soporte
                </button>
              </div>
              {cargSopVal ? (
                <p className="text-xs text-slate-500">Cargando soportes…</p>
              ) : soportesVal.length === 0 ? (
                <p className="text-xs text-slate-500">Sin soportes enviados por este usuario.</p>
              ) : (
                soportesVal.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong className="tabular-nums text-white">{dinero(s.monto_reportado)}</strong>{' '}
                        <span className="text-xs text-slate-400">
                          · {s.tipo === 'pago_total' ? 'Pago total' : 'Abono'} · {fechaLegible(s.created_at)}
                        </span>{' '}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${(ESTADOS_SOPORTE[s.estado] || ESTADOS_SOPORTE.pendiente).clase}`}
                        >
                          {(ESTADOS_SOPORTE[s.estado] || ESTADOS_SOPORTE.pendiente).texto}
                        </span>
                      </span>
                      <span className="flex gap-1.5">
                        <button type="button" className="btn-mini" onClick={() => verFotoVal(s)} title="Ver foto del soporte" aria-label="Ver foto del soporte">
                          🖼️
                        </button>
                        {s.estado === 'pendiente' && (
                          <>
                            <button
                              type="button"
                              className="btn-mini !text-emerald-300"
                              disabled={ocupado}
                              onClick={() => aprobarSopVal(s)}
                              title="Aprobar y acreditar a Caja Inscripción"
                            >
                              ✅
                            </button>
                            <button
                              type="button"
                              className="btn-mini !text-rose-300"
                              disabled={ocupado}
                              onClick={() => setRechazoVal({ id: s.id, texto: '' })}
                              title="Rechazar con comentario"
                            >
                              ⛔
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    {s.estado !== 'pendiente' && s.revisado_por_nombre && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        👤 {s.revisado_por_nombre}
                        {s.comentario_revision ? ` · 💬 ${s.comentario_revision}` : ''}
                      </p>
                    )}
                    {rechazoVal?.id === s.id && (
                      <form
                        onSubmit={enviarRechazoVal}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          className="campo"
                          placeholder="Motivo del rechazo (obligatorio)"
                          value={rechazoVal.texto}
                          onChange={(e) => setRechazoVal({ id: s.id, texto: e.target.value })}
                          maxLength={200}
                          required
                          autoFocus
                        />
                        <button type="submit" className="btn-peligro shrink-0" disabled={ocupado}>
                          Enviar
                        </button>
                        <button type="button" className="btn-fantasma shrink-0" onClick={() => setRechazoVal(null)}>
                          X
                        </button>
                      </form>
                    )}
                  </div>
                ))
              )}
              {/* Si todo fue recibido y aprobado y ya pagó el total: solo queda validar */}
              {!cargSopVal &&
                soportesVal.length > 0 &&
                soportesVal.every((s) => s.estado === 'aprobado') &&
                Number(validar.saldo_pendiente) <= 0 && (
                  <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    ✅ Soportes recibidos y aprobados, pago total cubierto: solo queda validar.
                  </p>
                )}
            </div>

            {/* Validación */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-300">
                Estado: <strong>{validar.pago_validado ? 'Validado ✔' : 'Sin validar'}</strong>
              </span>
              <button
                type="button"
                className="btn-mini"
                disabled={ocupado}
                onClick={() => validarPago(validar, validar.pago_validado ? 0 : 1)}
              >
                {validar.pago_validado ? '✖ Quitar validación' : '✔ Marcar validado'}
              </button>
            </div>

            {/* Abono + pago completo */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                abonarDesdeValidar(Number(montoVal));
              }}
              className="space-y-2 border-t border-white/10 pt-3"
            >
              <label className="etiqueta">Registrar abono</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="campo"
                  min="1000"
                  max={validar.saldo_pendiente}
                  step="1000"
                  value={montoVal}
                  onChange={(e) => setMontoVal(e.target.value)}
                  placeholder="20000"
                  required
                />
                <button type="submit" className="btn-oro shrink-0" disabled={ocupado}>
                  {ocupado ? '…' : 'Abonar'}
                </button>
              </div>
              <button
                type="button"
                className="btn-exito w-full"
                disabled={ocupado || Number(validar.saldo_pendiente) <= 0}
                onClick={pagoCompleto}
                title="Abonar todo el saldo pendiente"
              >
                ✅ Pago completo ({dinero(validar.saldo_pendiente)})
              </button>
              <p className="text-[11px] text-slate-500">Abono mínimo: {dinero(20000)}. Todo movimiento va a la Caja de Inscripción.</p>
            </form>

            <div className="flex justify-end">
              <button type="button" className="btn-fantasma" onClick={() => setValidar(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ Modal: foto de soporte (en validación) ============ */}
      <Modal abierto={!!visorVal} titulo="🧾 Soporte reportado" onCerrar={() => {
        if (visorVal?.url) URL.revokeObjectURL(visorVal.url);
        setVisorVal(null);
      }}>
        {visorVal && (
          <div className="space-y-3">
            <div className="flex justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              <img src={visorVal.url} alt="Soporte de pago" className="max-h-[55vh] w-auto object-contain" />
            </div>
            <p className="text-center text-sm text-slate-300">
              <strong className="tabular-nums text-white">{dinero(visorVal.soporte.monto_reportado)}</strong> ·{' '}
              {visorVal.soporte.tipo === 'pago_total' ? 'Pago total' : 'Abono'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

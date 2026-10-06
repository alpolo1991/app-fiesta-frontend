import { useCallback, useEffect, useState } from 'react';
import api, { mensajeError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TarjetaKPI from '../components/TarjetaKPI';
import { dinero, fechaLegible } from '../utils';

const MAXIMO = 1;

/**
 * Menú Acompañantes (máx 1 por usuario, precio fijo de administración).
 * - Usuario: registra/elimina los suyos (eliminar solo si aún no está pagado).
 * - Admin/Moderador: ve todos con su usuario y totales.
 */
export default function Acompanantes() {
  const { usuario } = useAuth();
  const { notificar } = useToast();
  const esStaff = usuario?.rol === 'admin' || usuario?.rol === 'moderador';
  const esAdmin = usuario?.rol === 'admin';
  const esMod = usuario?.rol === 'moderador';
  const esDueno = (a) => a.usuario_id === usuario?.id;
  // Editar: dueño, admin y mod (pagado o no). Borrar: admin siempre;
  // dueño y mod solo lo no pagado.
  const puedeEditar = (a) => esAdmin || esMod || esDueno(a);
  const puedeBorrar = (a) => esAdmin || (!a.pagado && (esDueno(a) || esMod));

  const [datos, setDatos] = useState({ lista: [], cantidad: 0, total: 0 });
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get(esStaff ? '/acompanantes' : '/acompanantes/mios');
      setDatos(data);
    } catch (error) {
      notificar(mensajeError(error, 'No se pudieron cargar los acompañantes.'), 'error');
    } finally {
      setCargando(false);
    }
  }, [esStaff, notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregar = async (e) => {
    e.preventDefault();
    const nom = nombre.trim();
    if (!nom) return notificar('Escribe el nombre del acompañante.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.post('/acompanantes', { nombre: nom });
      notificar(data.mensaje, 'exito');
      setNombre('');
      setDatos({ lista: data.lista, cantidad: data.cantidad, total: data.total });
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const guardarNombre = async (a) => {
    const nom = nombreEdit.trim();
    if (!nom) return notificar('Escribe el nombre del acompañante.', 'error');
    if (nom.length > 80) return notificar('El nombre no puede superar 80 caracteres.', 'error');
    setOcupado(true);
    try {
      const { data } = await api.put(`/acompanantes/${a.id}`, { nombre: nom });
      notificar(data.mensaje, 'exito');
      setEditandoId(null);
      if (esStaff) await cargar();
      else {
        const { data: mios } = await api.get('/acompanantes/mios');
        setDatos(mios);
      }
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`¿Eliminar a "${a.nombre}" de los acompañantes?`)) return;
    setOcupado(true);
    try {
      const { data } = await api.delete(`/acompanantes/${a.id}`);
      notificar(data.mensaje, 'exito');
      if (esStaff) await cargar();
      else setDatos({ lista: data.lista, cantidad: data.cantidad, total: data.total });
    } catch (error) {
      notificar(mensajeError(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Acompañantes</p>
        <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">👥 Mis acompañantes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Máximo <strong className="text-slate-200">{MAXIMO} por usuario</strong> · precio fijo de administración · cada
          uno suma su combo al pagar su saldo. Si ya está pagado solo se puede editar el nombre.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TarjetaKPI titulo="Acompañantes" icono="👥" valor={cargando ? '…' : `${datos.cantidad}/${MAXIMO}`} subtitulo="registrados" color="cielo" />
        <TarjetaKPI titulo="Total" icono="💰" valor={cargando ? '…' : dinero(datos.total)} subtitulo="sumado a tu saldo" color="oro" />
      </div>

      {!esStaff && (
        <form onSubmit={agregar} className="panela flex flex-col gap-2 p-4 sm:flex-row">
          <input
            className="campo"
            placeholder="Nombre y apellido del acompañante"
            maxLength={80}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={ocupado || datos.cantidad >= MAXIMO}
            required
          />
          <button type="submit" className="btn-oro shrink-0" disabled={ocupado || datos.cantidad >= MAXIMO}>
            {ocupado ? 'Agregando…' : '＋ Agregar'}
          </button>
        </form>
      )}

      <div className="panela divide-y divide-white/10 p-2">
        {cargando ? (
          <p className="p-6 text-center text-sm text-slate-500">Cargando…</p>
        ) : datos.lista.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Aún no hay acompañantes registrados. 🎊</p>
        ) : (
          datos.lista.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                {editandoId === a.id ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      guardarNombre(a);
                    }}
                  >
                    <input
                      className="campo"
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      maxLength={80}
                      required
                      autoFocus
                    />
                    <button type="submit" className="btn-oro shrink-0" disabled={ocupado}>
                      ✓
                    </button>
                    <button type="button" className="btn-fantasma shrink-0" onClick={() => setEditandoId(null)}>
                      X
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="truncate font-semibold text-white">
                      {a.nombre}{' '}
                      {a.pagado && (
                        <span className="ml-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          Pagado ✅
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.usuario_nombre ? `${a.usuario_nombre} · ` : ''}{fechaLegible(a.created_at)}
                    </p>
                  </>
                )}
              </div>
              {editandoId !== a.id && (
                <span className="flex items-center gap-2">
                  <strong className="tabular-nums text-amber-300">{dinero(a.monto)}</strong>
                  {puedeEditar(a) && (
                    <button
                      type="button"
                      className="btn-mini"
                      disabled={ocupado}
                      onClick={() => {
                        setEditandoId(a.id);
                        setNombreEdit(a.nombre);
                      }}
                      title="Editar nombre"
                      aria-label={`Editar nombre de ${a.nombre}`}
                    >
                      ✏️
                    </button>
                  )}
                  {puedeBorrar(a) && (
                    <button
                      type="button"
                      className="btn-mini !text-rose-300"
                      disabled={ocupado}
                      onClick={() => eliminar(a)}
                      title={a.pagado ? 'Eliminar (admin: ya pagado)' : 'Eliminar (aún no está pagado)'}
                      aria-label={`Eliminar acompañante ${a.nombre}`}
                    >
                      🗑
                    </button>
                  )}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

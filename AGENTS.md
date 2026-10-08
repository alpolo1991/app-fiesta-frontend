# AGENTS.md — Frontend

Instrucciones para agentes que trabajen en este repositorio.

## Qué es

Interfaz de la **fiesta empresarial de fin de año** (inscripción configurable,
default $50.000, abono mínimo $20.000, máx 1 acompañante) con roles
ADMIN / MODERADOR / USUARIO. Entregas de combo bloqueadas sin pago confirmado.
Idioma: español.

## Stack y estructura

React 18 + Vite + React Router + Axios + Context API + Tailwind CSS v4.

- `src/App.jsx` → rutas; `<RutaProtegida roles={[]}>` solo decide navegación
  (el permiso real vive en el backend).
- `src/api/client.js` → instancia Axios (baseURL `/api`) + descarga/imagen.
  **Usa `api` siempre** (nunca `axios` crudo: pierde `/api` y el JWT).
- `src/components/TarjetaKPI.jsx` → KPIs reutilizables.
- `VITE_API_URL` (prod, con `/api`), `VITE_API_TARGET` (proxy dev).

## Comandos

```bash
npm install
npm run dev     # Vite en :5173 (proxy /api → backend)
npm run build   # genera dist/ (debe salir exit 0)
```

## Convenciones

- Tema oscuro festivo dorado: clases de `src/index.css` (`.panela`,
  `.btn-oro`, `.btn-fantasma`, `.btn-mini`, `.campo`, `.tab`, ...). No uses
  Tailwind fuera de ese lenguaje.
- Botones: compactos en compu, 44px en táctil (`pointer: coarse` en CSS).
- Tablas → tarjetas apiladas en teléfono (`hidden md:block` / `md:hidden`).
- Acciones en tablas: caja `.acciones-tabla` en `td.td-acciones`; en tabla
  solo icono (con `title` + `aria-label`), en tarjeta móvil texto completo.
- Registro manual: `ModalRegistrarUsuario` en Usuarios (admin y mod), mismos
  datos que el registro público sin pedir clave (genera temporal);
  WhatsApp siempre `(OBLIGATORIO)`.
- UUID visible solo lectura (resultado del registro manual + ficha); jamás
  editable ni enviado al crear.
- Toasts: `useToast().notificar(mensaje, 'exito'|'error'|'info')`.
- Modales con `role="dialog"`, cierre con Escape y clic fuera.
- Entregas: botones `+1` deshabilitados si rol usuario y
  `estado_pago !== 'pagado'` (staff exento); sin botón manual (el combo se
  auto-completa al entregar todo y muestra `✅ Combo entregado`). Totales
  siempre desde backend (`monto_abonado + saldo_pendiente`), nunca `50000` fijo.
- KPI Pagados (admin/mod): total personas confirmadas =
  `ganancias.inscripcionesConfirmadas + ganancias.acompanantesConfirmados`.
- Perfil: si `pagadoTotal` botón verde `btn-exito` con conteo y scroll a
  comprobantes; si debe, botón dorado con saldo. Usuarios pagados en verde
  (`✅ Pagado · $0`); Eliminar deshabilitado con pagos registrados.
- Fechas: `fechaLegible()` interpreta la BD (UTC) y muestra
  `America/Bogota`.
- WhatsApp: todo mensaje lleva el bloque de `bloqueEventoWhatsApp()`
  (nombre, dirección, fecha/hora y enlace); la dirección sale de
  `lugar_evento` en Configuración.
- Imágenes: el límite lo define el admin (`tamano_max_imagen_mb`, hasta 3 MB);
  `ModalPago` y QR lo leen de `/configuracion` (default 1 MB).
- Para probar la UI sin tocar datos reales: backend temporal
  (`FIESTA_DB_PATH`/`FIESTA_UPLOADS_DIR` en `/tmp`, otro puerto) y Vite con
  `VITE_API_TARGET` a ese backend.

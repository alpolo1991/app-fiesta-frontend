# AGENTS.md — Frontend

Instrucciones para agentes que trabajen en este repositorio.

## Qué es

Interfaz de la **fiesta empresarial de fin de año** (Cupo $50.000, abono
mínimo $20.000) con roles ADMIN / MODERADOR / USUARIO. Idioma: español.

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
- Toasts: `useToast().notificar(mensaje, 'exito'|'error'|'info')`.
- Modales con `role="dialog"`, cierre con Escape y clic fuera.
- Para probar la UI sin tocar datos reales: backend temporal
  (`FIESTA_DB_PATH`/`FIESTA_UPLOADS_DIR` en `/tmp`, otro puerto) y Vite con
  `VITE_API_TARGET` a ese backend.

# 🎉 Fiesta Fin de Año 2026 — Frontend

Interfaz de la fiesta empresarial (inscripción configurable por admin, default
$50.000, abono mínimo $20.000): registro con WhatsApp, pago con soporte en
imagen o QR, encuesta, 1 acompañante máx, entregas de combo solo con pago
confirmado y paneles por rol.

> Repo independiente del backend. Despliegue: **Vercel** (`vercel.json`).
> Toda la interfaz está en **español**.

## 🧰 Stack

React 18 + Vite + React Router + Axios + Context API + Tailwind CSS v4
(tema oscuro festivo dorado).

## 🚀 Desarrollo local

```bash
npm install
npm run dev            # Vite en :5173 (proxy /api → backend :4000)
```

El backend debe correr en `:4000` (o ajusta `VITE_API_TARGET`).

## 🔑 Variables (`cp .env.example .env`)

| Variable | Ejemplo |
|---|---|
| `VITE_API_URL` | `https://tu-api.onrender.com/api` (prod, **con `/api`**) |
| `VITE_API_TARGET` | `http://localhost:4000` (solo proxy dev) |

## ☁️ Deploy en Vercel

1. Importa este repo con **Root Directory = `.`** (este repo ya ES el frontend).
2. Framework: Vite · Build: `npm run build` · Output: `dist` (ver `vercel.json`,
   incluye rewrites del SPA).
3. Pon `VITE_API_URL` con la URL de Render **+ `/api`**.
4. En el backend agrega tu URL de Vercel a `FRONTEND_URL` (CORS).

## 📄 Rutas

Públicas: `/login`, `/registro`, `/recuperar`, `/soporte` (+ cuenta regresiva).
Protegidas: `/perfil`, `/encuesta`, `/acompanantes` (todos); `/admin` (admin);
`/moderador` (moderador); `/inventario`, `/entregas` (admin y moderador).

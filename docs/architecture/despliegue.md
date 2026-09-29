# Estrategia de Infraestructura y Despliegue

Este documento define los servicios y la arquitectura de despliegue para los componentes de **CouchOne Fit**, los criterios técnicos de selección y las variables de entorno necesarias para producción.

---

## 1. Resumen técnico de plataformas

| Componente | Servicio | Plan | Justificación técnica |
| :--- | :--- | :--- | :--- |
| **Web / PWA** (`apps/web`) | **Vercel** | Hobby (Gratuito) | Despliegue optimizado para SPAs en Vite/React, CDN global de baja latencia, soporte nativo de monorepos y preview deployments por PR. |
| **API / Backend** (`apps/api`) | **Render** | Free Web Service | Soporta procesos continuos de Node.js/Express (`app.listen`), integración directa con GitHub y plan gratuito sin requerir tarjeta. |
| **Base de Datos / Auth** | **Supabase** | Free Tier | Instancia administrada de PostgreSQL, autenticación integrada, buckets de storage para fotos de progreso y backups automáticos. |
| **Móvil** (`apps/mobile`) | **GitHub Releases / Local** | N/A | Compilación de APK / App Bundle para instalación directa en dispositivos de prueba y emuladores. |

---

## 2. Frontend Web / PWA (Vercel)

Se seleccionó **Vercel** sobre Netlify para el frontend por su integración nativa con proyectos Vite y mejor rendimiento de compilación en monorepos.

### Parámetros de configuración (Panel de Vercel)
- **Framework Preset:** `Vite`
- **Root Directory:** `apps/web`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### Enrutamiento SPA
Para prevenir errores 404 al refrescar rutas del cliente (`/login`, `/clientes`, etc.), el proyecto incluye la regla de reescritura en [apps/web/vercel.json](../../apps/web/vercel.json):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Variables de entorno (`apps/web`)
| Variable | Requerida | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Sí | URL pública de la API en Render | `https://couchonefit-api.onrender.com` |

---

## 3. Backend API (Render)

La API corre como un proceso persistente de Node.js que expone endpoints REST a la aplicación web y a la app móvil.

- **URL activa del servicio:** `https://couchonefit-api.onrender.com`
- **Health check:** `https://couchonefit-api.onrender.com/api/health`
- **Root Directory:** `apps/api`
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Instance Type:** `Free`

> **Comportamiento en reposo:** En el plan gratuito, el servicio se suspende tras 15 minutos sin tráfico. La primera solicitud entrante tarda entre 30 y 45 segundos en responder mientras se levanta el contenedor.

### Variables de entorno (`apps/api`)
| Variable | Requerida | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- |
| `PORT` | Sí | Puerto asignado por Render (o 3000 por defecto) | `10000` |
| `NODE_ENV` | Sí | Entorno de ejecución | `production` |
| `CORS_ORIGIN` | Sí | Dominio permitido para solicitudes web | `https://couchonefit-web.vercel.app` |
| `SUPABASE_URL` | Sí | Endpoint base del proyecto Supabase | `https://pcoyrxdeiigynmmpxtng.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Sí | Llave pública de cliente (sujeta a RLS) | `sb_publishable_8a45...` |
| `SUPABASE_SECRET_KEY` | Sí | Llave secreta / service role del backend | `sb_secret_j45Z...` |
| `SUPABASE_JWKS_URL` | Sí | URL JWKS para validación de tokens JWT | `https://pcoyrxdeiigynmmpxtng.supabase.co/auth/v1/.well-known/jwks.json` |

---

## 4. Base de Datos y Almacenamiento (Supabase)

La capa de datos se centraliza en **Supabase**:
- **PostgreSQL:** Tablas relacionales para profesionales, expedientes, planes nutricionales, rutinas y check-ins diarios *(esquema en proceso de diseño)*.
- **Storage:** Buckets protegidos con políticas RLS para almacenar fotografías de evolución antropométrica.
- **Acceso:** Las operaciones de lectura y escritura pasan exclusivamente por la API (`apps/api`), garantizando el aislamiento de datos por profesional (`RNF06`, `RS01`).
- **Detalle de conexión y estado:** Consulta la documentación centralizada en [docs/database/README.md](../database/README.md).

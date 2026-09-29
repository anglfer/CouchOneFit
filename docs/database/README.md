# Base de Datos (Supabase / PostgreSQL)

Este documento centraliza la información de conexión, credenciales de entorno y estado actual de la base de datos de **CouchOne Fit**.

---

## 1. Estado actual

| Aspecto               | Estado        | Detalle                                                                      |
| :-------------------- | :------------ | :--------------------------------------------------------------------------- |
| **Instancia / Motor** | Activo        | PostgreSQL administrado vía Supabase Cloud.                                  |
| **Conexión**          | Establecida   | Credenciales de proyecto generadas y listas para configurar.                 |
| **Esquema (Schema)**  | **Pendiente** | Aún no hay tablas, tipos, vistas ni migraciones creadas en la base de datos. |
| **Políticas RLS**     | Pendiente     | Se implementarán una vez modelado el esquema.                                |

---

## 2. Parámetros y Credenciales de Conexión

Las credenciales de acceso para la instancia de Supabase de CouchOne Fit son:

```env
SUPABASE_URL=https://pcoyrxdeiigynmmpxtng.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_8a45h1VJmmAJFCwz4PlLQQ_uyX-244W
SUPABASE_SECRET_KEY=sb_secret_j45Z1Y_-PsSl7RFdSHvhkA_SRgZuys5
SUPABASE_JWKS_URL=https://pcoyrxdeiigynmmpxtng.supabase.co/auth/v1/.well-known/jwks.json
```

---

## 3. Guía de uso y Política de Seguridad

> [!CAUTION]
> **Aislamiento de la Secret Key:** `SUPABASE_SECRET_KEY` tiene privilegios de servicio administrativo (bypassea RLS). **Únicamente debe residir en variables de entorno del backend (`apps/api`)** o servidores seguros (como Render). **NUNCA** debe exponerse ni compilarse en la aplicación Web (`apps/web`) ni en la aplicación móvil (`apps/mobile`).

### Propósito de cada variable:

1. **`SUPABASE_URL`:**
   - Endpoint base de la API REST y servicios de autenticación y almacenamiento del proyecto Supabase.
2. **`SUPABASE_PUBLISHABLE_KEY`:**
   - Llave pública (análoga a la anterior `anon key`). Diseñada para ser utilizada en clientes de forma segura, sujeta estrictamente a las políticas de seguridad a nivel de fila (_Row Level Security - RLS_).
3. **`SUPABASE_SECRET_KEY`:**
   - Llave secreta con rol de servicio administrativo (_service role_). Utilizada por la API central en Node.js/Express para ejecutar tareas administrativas, migraciones, sincronizaciones o consultas privilegiadas.
4. **`SUPABASE_JWKS_URL`:**
   - Endpoint JWKS (_JSON Web Key Set_). Contiene el conjunto de claves públicas para validar criptográficamente la firma de los tokens JWT emitidos por Supabase Auth sin necesidad de contactar al servidor en cada petición.

---

## 4. Configuración en la API Backend (`apps/api`)

En el archivo local `apps/api/.env` (ignorado en Git):

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Conexión Supabase
SUPABASE_URL=https://pcoyrxdeiigynmmpxtng.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_8a45h1VJmmAJFCwz4PlLQQ_uyX-244W
SUPABASE_SECRET_KEY=sb_secret_j45Z1Y_-PsSl7RFdSHvhkA_SRgZuys5
SUPABASE_JWKS_URL=https://pcoyrxdeiigynmmpxtng.supabase.co/auth/v1/.well-known/jwks.json
```

---

## 5. Próximos pasos: Diseño e implementación del esquema

Una vez lista la conexión, el siguiente sprint abordará el diseño y la ejecución del esquema de datos:

1. **Modelado Entidad-Relación (DER):**
   - Entidades principales
2. **Estrategia de Migraciones:**
   - Definición de scripts SQL versionados o herramienta de migraciones (Supabase CLI / Prisma / Kysely / TypeORM).
3. **Definición de RLS (Row Level Security):**
   - Garantizar aislamiento estricto por profesional (`RNF06`, `RS01`).

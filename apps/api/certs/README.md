# CA pública de Supabase

`supabase-root-2021.crt` es el certificado público de la autoridad de Supabase,
no una clave privada ni un secreto del proyecto. Se versiona para que cada
computadora use el mismo archivo al clonar el repositorio.

En `apps/api/.env`, conserva la conexión del proyecto y usa estos parámetros:

```text
sslmode=verify-full&sslrootcert=certs/supabase-root-2021.crt
```

Ejecuta `npm run dev` y `npm run db:migrate` desde `apps/api`, o usa
`npm --prefix apps/api run dev` desde la raíz. npm establece el directorio de
la aplicación, por lo que la ruta relativa funciona sin nombres de usuario de
Windows. Si ejecutas Node directamente, usa también `apps/api` como directorio.
El `.env` con las credenciales permanece ignorado por Git.

Fuente HTTPS oficial:
[Supabase Root 2021 CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt).
Consulta la [guía de TLS de Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement)
antes de sustituir la CA. Esta configuración conserva la comprobación del
certificado y del nombre del servidor; no desactives la verificación TLS.

- Vigencia hasta: 26 de abril de 2031, 10:56:53 UTC.
- Huella SHA-256 del certificado:
  `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

Solo habrá que actualizar este archivo cuando Supabase cambie la autoridad o
antes de su caducidad, no al cambiar de computadora. Las credenciales y el
secreto JWT siguen siendo configuración privada de cada entorno.

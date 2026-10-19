# Estrategia de Infraestructura y Despliegue

Arquitectura operativa de CouchOne Fit: Web/PWA, API y PostgreSQL centralizado. Registro, acceso profesional y sesiones están implementados localmente; pagos y demás módulos conservan sus propios incrementos. Las instrucciones y objetivos de este documento requieren verificación en el entorno de despliegue; no acreditan disponibilidad ni configuración remota. Plan y dependencias: [PLAN_TRABAJO_V2.md](../../PLAN_TRABAJO_V2.md).

---

## 1. Resumen técnico de plataformas

| Componente                     | Servicio                        | Plan                                             | Justificación técnica                                                                                                                      |
| :----------------------------- | :------------------------------ | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Web / PWA** (`apps/web`)     | **Vercel**                      | Cuenta existente, límites/accesos por verificar  | SPA React/Vite y proxy externo `/api` mismo origen; elegibilidad/capacidad real de colaboradores gate humano autorizado, sin contratación. |
| **API / Backend** (`apps/api`) | **Render**                      | Free existente, sujeto verificación              | Express/REST y auth propios; reposo/cold start sin SLA, no garantía de servicio continuo.                                                  |
| **PostgreSQL**                 | **Supabase**                    | Cuenta existente, límites/permisos por verificar | Solo persistencia negocio por API/RLS/contexto confiable; sin Supabase Auth seleccionado ni fotos/Storage V2 ni backups Free supuestos.    |
| **Móvil** (`apps/mobile`)      | **Releases / local autorizado** | Sin tienda                                       | **APK Android release firmado**, no AAB/iOS/Windows nativo; Omarfirma bajoPukzil, keyfueraGit.                                             |

---

## 2. Frontend Web / PWA (Vercel)

Se conserva Vercel/React/Vite, sin migración ni compra de dominio. Propietario operativo cuenta:Ferxxo; delegar mínimo permiso solo si capacidad real del plan lo permite, nunca compartir keys. No se afirma que colaboradores estén provisionados. TT-017 debe verificar límites/elegibilidad y proxy/cookies con cuenta autorizada.

### Parámetros de configuración (Panel de Vercel)

- **Framework Preset:** `Vite`
- **Root Directory:** `apps/web`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command propuesto:** `npm ci` con lock existente; confirmar en TT-008/017, no cambio de configuración ejecutado aquí.

### Enrutamiento SPA

El archivo [apps/web/vercel.json](../../apps/web/vercel.json) del corte contiene fallbackSPA; el ejemplo histórico siguiente **no es la topología completa vigente ni proxy implementado**:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Variables de entorno (`apps/web`)

| Variable       | Requerida | Descripción                                                                          | Ejemplo                           |
| :------------- | :-------- | :----------------------------------------------------------------------------------- | :-------------------------------- |
| `VITE_API_URL` | Sí        | Base Web **mismo origen `/api`**, según contrato del helper TT-002; no doble prefijo | `/api` (sugerido, no configurado) |

### Topología de sesión decidida — pendiente de implementación/pruebas

- Navegador→Vercel `/api/:path`→Render HTTPS **`/api/:path`** preservando prefijo/query/método/body/cookies; aplicar proxy antes fallbackSPA, assets/SW/manifest fuerafallback incorrecto. Vite proxy local misma topología. No cross-site cookie `None` ni compra dominio.
- Cookies host-only **sin Domain** (`strip Domain` si upstream lo incorpora), HttpOnly/Secure/SameSiteStrict; preservar correctamente múltiples `Set-Cookie`/flags sin cachearlo ni registrar tokens. HTTPSprod; HTTPdev excepción local sin datos reales permite noSecure. Web privados `Cache-Control: no-store`, no cacheCDN/proxy/SW ni tokens en frontend; verificar respuesta real, no asumirlo por rewrite.
- CSRF mutaciones: Originallowlist **y** token; CORS/orígenes por entorno con mínimos permisos. Confiar forwardedheaders solo bajo topología verificada, nunca en rol/identidad enviada por cliente. Móvil conecta RenderTLS/Bearersecurestore, no requiere proxyWeb.
- AuthAPI/PostgreSQL: Argon2id19MiB/t2/p1 mínimo conbenchmark, JWT15min HS256allowlist/iss/aud/exp/sub/sid, sesión/cuentaBD porrequest failclosed/rolvigente, refreshhashrotativo30d **absolutos desde login**/replayrevocafamilia y logoutinmediato. No SupabaseJWKS/proveedor integrado como opción pendiente.
- Emisión/consumo invitación/reset y registro aviso requieren contratos TT-009; rutas/DDL/variables aquí son **sugeridos**, no implementados. Validar proxy/no-cache/CSRF/refresh/logout/roles enbrowserreal antespromover.

---

## 3. Backend API (Render)

La API corre como un proceso persistente de Node.js que expone endpoints REST a la aplicación web y a la app móvil.

- **Destino histórico documentado:** dominio existente del servicio, resolver desde configuración autorizada sin afirmar que esté operativo.
- **Liveness:** `/api/health`; readiness de PostgreSQL/permisos/migraciones separado, aún TT-016. Un200health no certifica negocio.
- **Root Directory:** `apps/api`
- **Environment:** `Node`
- **Build Command propuesto:** `npm ci && npm run build` (TT-008/016, no ejecutado aquí)
- **Start Command:** `npm start`
- **Instance Type:** `Free`

> **Fuente S-02 contrastada14-oct:** RenderFree reposa tras15min sintráfico, arranque aproximado1min y discoefímero; no30–45s garantizados. DEC-013 adopta cold≤60s como objetivo **empírico noSLA**,5muestrastras20minreposo, separado dewarm; si incumple, advertir limitaciónsin inventargarantía. Sinmonitorcontinuocada5min/keepalive; solo despliegues o ventanas de revisión autorizadas conhealth/readiness, coldtests aparte.

### Variables de entorno (`apps/api`)

| Variable                             | Requerida        | Descripción                                                                            | Ejemplo                              |
| :----------------------------------- | :--------------- | :------------------------------------------------------------------------------------- | :----------------------------------- |
| `PORT`                               | Sí               | Puerto asignado por Render (o 3000 por defecto)                                        | `10000`                              |
| `NODE_ENV`                           | Sí               | Entorno de ejecución                                                                   | `production`                         |
| `CORS_ORIGIN`                        | Sí               | Dominio permitido para solicitudes web                                                 | `https://couchonefit-web.vercel.app` |
| `DATABASE_URL`     | Sí               | ConexiónTLS/pool rolordinario `pg`, secreto solo servidor; nombre definitivoTT-008/009 | Configurar fueraGit, sin valor aquí  |
| Credencial de migración separada     | ProcedimientoDDL | Solo migraciones controladas, nunca handler ordinario                                  | Custodiaexterna, sin valor aquí      |
| `AUTH_JWT_SECRET` | Sí               | HS256 robusto/rotacióncontrolada, no frontend/keypublicada                             | Custodiaexterna, sin valor aquí      |

VariablesSupabase/Auth/JWKS del borrador son antecedentes, **no requisitos del auth propio elegido**. No leer/copiar secretos del READMEBD, no service_role bypassRLS para negocio. TT-001 requiere rotaciónhumana autorizada de exposiciones históricas; esta edición no acredita rotación.

---

## 4. PostgreSQL (Supabase), sin medios V2

La capa de datos se centraliza en **Supabase**:

- **PostgreSQL:** Tablas relacionales para profesionales, expedientes, planes nutricionales, rutinas y check-ins diarios _(esquema en proceso de diseño)_.
- **SinStorage/fotos:** HU-038fueraV2/8SPexcluidos; HU-025pospuesta/5SPexcluidos, no mediosa respaldar.
- **Acceso:** exclusivamenteAPI, `pg`/SQLparametrizado/migracionesversionadas, conexiónúnicaportxn y `SET LOCAL`contextoRLSderivadodesesiónconfiable; grantsmínimos/rolordinario vsDDL separados. Rolespúblicos sinaccesonegocio. AislamientoRNF06/RS01 **debe probarse**, no garantizado por centralizarAPI.
- **Estado real:** corte8-oct sin tablas propias/policies/migraciones negocio; conexión real pendienteTT-003/016, no“Supabaseconectado”por variables. Modelos/rutas/DDL documentales sugeridos hastaTT-003/009.

## 5. Objetivos, respaldo y retención — DEC-011/013

- Warm p95lecturas800ms/escrituras1500ms,15concurrentes/5rps5min,≥500muestrasportipo (extenderhastaalcanzar). Fixture8prof/56clientes/100000filas tamañoobjetivo≤500MBmedido,no capimpuesto;200eventosdiariosno200filas (serieshijassemidenaparte).
- Read-after-COMMITinmediato/noeventualstale; dashboardforeground60s+latencia/no fondo/keepawake,móvilrefreshmanualwarm5sobjetivo. Timeoutwarmservidor15s/cliente20s/bootstrap65ssoloarranque, sin retryciegoescritura.
- Disponibilidadmensualobservada/reportada, **sin mínimo99%SLA contractual**;99%historico/futuropagado. Cada despliegue requiere health, readiness y recorrido funcional verificados.
- Backupdiario03:00America/Mexico_City/cifradooffsite7d, Omar ejecuta bajoFranela; últimocorrecto/alertafallo-gap/reconocimiento/fallback manual antes y después de cada revisión. RPOobjetivo≤24hdesdeéxito/RTO≤4hrestoremedido roles/datos/constraints/versiones/relaciones; sincopiaválidaverificación de promoción. No backupsadministradosFreeasumidos ni copia en discoefímeroRender.
- Retención: baja lógica y conservación de historial; política por categoría pendiente de definición. Sin purga de cuentas por hitos de entrega. Limpiar datos de pruebas aislados al terminar sus ejecuciones; respaldos y restauración deben respetar las eliminaciones autorizadas.

## 6. Entrega y gates externos — DEC-012/014/015/016

APKAndroidreleasefirmadoOmarbajoPukzil,keyfueraGit; mínimaAPI24política sujeta dependency/buildgate, emuladores24/36pruebasrequeridas,nofísicoprometido. NoiOS/Windowsnativo/AAB/tiendasV2. WebChrome/Edge/FirefoxestablesaltestWindows320/390/768/1280/teclado; PWAcapacidadessegúnmatrizreal, locksconfirmarsinupgrading.

Información de registro común Web/móvil, con versión y fecha confirmadas antes del primer uso (HU-041; alta atómica HU-001/008). La política de privacidad completa requiere responsable, contacto, finalidades, conservación y mecanismos de atención; no se atribuyen aprobaciones legales inexistentes.

Cuatroquincenas19-oct–1-nov/2–15-nov/16–29-nov/30-nov–13-dic2026TARGET, S0–S7incrementos, WIP1/reserva30%horasbrutas×0,7sinSP→horas/reporteasíncronosemanal/review1-nov.271SPactivos no prueba capacidad.

**Externos aún no acreditados:** humanosautorizadosconfirmanhoras/fechaoficial/accesos/límitescolaboracióncloud/custodiafirma; HU-023gateoriginalescompletos/fixturesantesReady; políticadeprivacidadyretenciónrequierenresponsable/contactoyrevisión.  NingunapreguntaproductoV2pendiente; no compras/config/cloud/testsimplementadosporestedocumento.


HU-002 incorpora sesión profesional: configurar `AUTH_JWT_SECRET` aleatorio de al menos 32 bytes solo en API y conceder `couchone_authentication` al usuario runtime tras aplicar la migración de sesiones y el corte coordinado de nombres. Ver [contrato de acceso](../epicas/ep-01-identidad-y-acceso/hu-002/README.md). Login/refresh/logout requieren Origin Web permitido y CSRF por proxy del mismo origen; verificar cookies Secure y no-store en staging antes de promover.

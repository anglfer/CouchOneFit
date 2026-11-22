---
version: 1
slug: "src-features-marketing-pages-marketingpage-tsx"
primary_target: "src/features/marketing/pages/MarketingPage.tsx"
related_targets: ["src/features/auth/components/AuthShell.tsx"]
---

## Scope

Landing pública (`/`) en modo Persuade, más el marco de acceso (`/acceso`, `/recuperar`). Visitante: entrenador o nutriólogo en México evaluando la herramienta desde su computadora o teléfono. Acción: crear cuenta o elegir plan; quien ya tiene cuenta, iniciar sesión. Prueba: capturas reales del panel y de la app móvil con datos de demostración. Restricciones: sin testimonios, logos, métricas ni pruebas gratis; precios desde `/api/plans`; crear la cuenta no cobra.

## Direction contract

THESIS: La página es el producto trabajando: el primer pantallazo muestra el panel real del profesional y el teléfono real del cliente, cambiando por módulo, bajo un titular llano. Rechaza el eslogan centrado sobre un tablero simulado y la fila de tarjetas con ícono.

OWN-WORLD: El sistema del propio panel. Fondos blanco y #F8F9FD, tinta #090918, índigo #4037F7 como único campo comprometido (losa del escenario del hero y banda de cierre), azul noche #050A1A para el pasaje "dos lados". Sans del sistema (Segoe UI Variable / system-ui) en cortes display y texto. Controles de 12px, marcos de 16–24px, marcos de navegador y teléfono alrededor de capturas reales.

STORY: El profesional entiende en segundos que prescribe en la web y su cliente lo sigue en el teléfono sobre un mismo expediente; lo cree porque cada imagen es una captura real; actúa con "Crear mi cuenta" o "Elegir plan".

FIRST VIEWPORT: Navegación de 68px. Fila de titular: H1 a ~68px a la izquierda (7 columnas); subtítulo, "Crear mi cuenta" primario, "Ver planes" secundario y la nota de que no hay cobro a la derecha (5 columnas). Debajo, losa índigo a todo el contenedor desde ~400px: cuatro pestañas de módulo en su borde superior (Inicio, Expediente, Entrenamiento, Seguimiento), marco de navegador con la captura del panel al ~80% del ancho y la captura del teléfono montada sobre el borde derecho; el pliegue corta la losa.

FORM: Hero de producto con escaparate de módulos por pestañas, posición 3 de 7 en la lista propia (lead repartido). seed:9062239e7ff0ce08. Aumentos: de fight poster, el pasaje "dos lados" es una división espejada real hasta los bordes con el teléfono en el eje; de provenance ribbon, "Cómo funciona" corre por una sola línea continua a través de pasos ordenados.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

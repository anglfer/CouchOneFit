---
version: 1
slug: "src-features-marketing-pages-marketingpage-tsx"
primary_target: "src/features/marketing/pages/MarketingPage.tsx"
related_targets: ["src/features/auth/components/AuthShell.tsx"]
---

Scope: landing pública `/` (Persuade) y marco de acceso compartido por `/acceso`, `/registro` y `/recuperar`.

Audiencia: entrenadores y nutriólogos que evalúan si llevar a sus clientes aquí. Acción: «Crear mi cuenta» (registro) o «Elegir plan». Prueba: capturas reales del panel y de la app móvil con datos ficticios. Restricciones: precios desde `/api/plans`, crear cuenta no cobra, sin testimonios ni métricas inventadas, sin etiquetas sobre los títulos.

## Direction contract

THESIS: CouchOne Fit como señalética deportiva: cada módulo (Evaluación, Alimentación, Entrenamiento, Seguimiento) es una disciplina con pictograma y color propios, y el producto real se enmarca con anillos concéntricos. Rechaza el hero SaaS índigo con filas de tarjetas iguales.

OWN-WORLD: blanco #FFFFFF, negro #000000, rosa mexicano #E5007D (acción), cobalto #2335C9, naranja #FF6A13, verde #00A35C. Unbounded en titulares y señales; anillos concéntricos de 8px; pictogramas blancos sobre cuadros de color; esquinas rectas; secciones como campos de color completos; una sola banda negra, el cierre.

STORY: el profesional entiende que todo lo de un cliente vive en un expediente, ve el panel y la app reales, lee planes claros y crea su cuenta.

FIRST VIEWPORT: izquierda, titular Unbounded con contorno de líneas paralelas, párrafo, «Crear mi cuenta» rosa y «Ver planes»; debajo la tira de cuatro pictogramas. Derecha, captura real del panel con anillos rosa/cobalto/naranja y el teléfono con la app superpuesto abajo. Interacción firma: la tira de pictogramas cambia la captura y el color de sus anillos, animado una vez.

FORM: Señalética deportiva mexicana, posición 7 de 7; seed:c96798cd2e473bfd.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

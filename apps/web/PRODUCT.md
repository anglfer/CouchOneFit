# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Profesional (comprador):** entrenadores y nutriólogos en México que llevan el seguimiento individual de una cartera de clientes. Trabajan desde computadora, tablet o móvil con la web/PWA instalable. Es quien visita la landing, contrata un plan y entra por `/acceso`.
- **Cliente (usuario final del profesional):** consulta su día y registra check-ins desde la app móvil (Flutter). No contrata nada; se vincula con un código individual de un solo uso.
- **Administración interna:** también entra por `/acceso` y opera planes y soporte desde `/admin`.

## Product Purpose

Reunir en un solo expediente por persona la evaluación física, la alimentación, el entrenamiento y el seguimiento diario, para que el profesional decida con contexto y el cliente sepa qué hacer cada día. Éxito: el profesional crea su cuenta, registra a sus clientes y los acompaña sin hojas sueltas ni chats dispersos.

## Positioning

El profesional prescribe y el cliente registra, sobre el mismo expediente: lo que el cliente anota en su teléfono (peso, sueño, energía, estrés, hambre, cumplimiento, series) aparece en el panel del profesional junto a sus evaluaciones y planes. El cliente nunca modifica lo prescrito.

## Operating Context

- Profesional: panel web con navegación lateral (Inicio, Clientes, expediente con pestañas Resumen/Entrenamiento/Evaluación/Alimentación/Seguimiento, Rutinas, Alimentos —biblioteca propia de alimentos y recetas—, suscripción), instalable como app y con lectura sin conexión.
- Cliente: app móvil con su día, rutina activa, plan de alimentación, check-in diario y progreso habilitado.
- Flujo: expediente → código de invitación de un solo uso → el cliente crea credenciales → planes activos → check-ins y sesiones → evolución.

## Capabilities and Constraints

- Planes desde la API (`/api/plans`): Básico 10 clientes activos / $299 MXN, Pro 30 / $599 MXN, Élite ilimitados / $999 MXN al mes.
- Crear la cuenta no cobra ni activa la suscripción; el checkout es simulado (sin cobros reales).
- Edad mínima del cliente: 16 años. Datos de salud sensibles; aviso de privacidad en `/privacidad`.
- Textos visibles en español (es-MX); código en inglés.

## Brand Commitments

- Nombre **CouchOne Fit**, isotipo C1 (`public/brand/`, `components/LogoMark.tsx`) y paleta de marca índigo aprobada el 16-oct-2026 (`DESIGN.md` raíz).
- Lo público (landing, acceso, registro, recuperación) debe sentirse del mismo producto que el panel que el profesional usará después: sobrio, preciso y profesional. Un intento previo con estética de señalética/brutalista (rama `brutalista`, 21-nov-2026) quedó descartado por la persona usuaria.

## Evidence on Hand

- Capturas reales del panel web y de la app móvil, tomadas con datos ficticios sembrados en la base local de desarrollo (`public/marketing/`). Nombres y cifras de las capturas son de demostración.
- No existen testimonios, logos de clientes, métricas de uso, pruebas gratis ni integraciones: no se inventan.

## Product Principles

1. Mostrar el producto real antes que describirlo.
2. El profesional conserva el control clínico: prescribe, revisa y decide; el sistema no sustituye su criterio.
3. Claridad sobre promesa: cada afirmación corresponde a algo que el sistema ya hace.
4. Lo que registra el cliente vale tanto como lo que prescribe el profesional.

## Accessibility & Inclusion

Contraste AA, foco visible, objetivos táctiles de al menos 44px, respeto a `prefers-reduced-motion` y tema claro/oscuro con preferencia guardada.

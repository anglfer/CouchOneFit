# Autoservicio y pago simulado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** El profesional contrata/sube de plan mediante pago simulado completo; administrador solo consulta suscripciones.
**Architecture:** Feature SaaS existente con validadores, servicios, repositorios transaccionales, simulador en servidor y checkout React. Reutilizar sesión, CSRF, bloqueo por profesional y auditoría.
**Tech Stack:** Express/TypeScript/pg/PostgreSQL y React/Vite; sin dependencias nuevas.
**Spec:** ../specs/2026-10-25-autoservicio-pago-simulado-design.md

## Global Constraints

Precio completo, sin prorrateo; nuevo mes calendario UTC desde aprobación. Instrumentos ficticios, sin PAN/CVV reales. Ningún admin modifica plan, vigencia o estado. Migraciones aplicadas inmutables. Preservar clientes y las correcciones previas.

## Review Focus

Doble envío/reintento recupera la misma operación. Cotización obsoleta no activa. Fallo de auditoría revierte. Vencimiento de fin de mes se ajusta. Recargar durante procesamiento recupera resultado e historial.

### Task 1 — API/persistencia y permisos

Files: features/saas/{types,validators,services,repositories,controllers,routes}/checkout.ts; admin/routes/admin.ts; migración 202610260002; schema integrado; tests/checkout.test.ts y saas.test.ts.
Interfaces: GET /api/me/plans; POST /api/me/payments {planId,idempotencyKey}; GET /api/me/payments y /:id; POST /:id/confirm {instrument}; POST /:id/cancel.
- [x] Escribir y ejecutar pruebas inicialmente fallidas: admin403 ante toda mutación de suscripción; cotización propietaria; aprobación/cupo; rechazo/cancelación/error; fraude de precio/actor; caducidad/cambio de catálogo; doble confirmación/finalización; auditoría fallida; mes calendario.
- [x] Añadir operaciones con instantáneas y estados pending/processing/succeeded/failed/cancelled, grants/RLS y función SQL protegida que aplica únicamente operación exitosa propia.
- [x] Implementar ciclo persistido con bloqueo profesional y revalidación de sesión, catálogo/suscripción. Procesamiento de 2s y quote10min. El resultado se resuelve en API, nunca en UI.
- [x] Retirar mutaciones administrativas de rutas/servicios/UI y permisos de BD; adaptar fixtures anteriores como preparación privilegiada de datos, no endpoints del producto.
- [x] Ejecutar suite completa, compilación API y equivalencia migraciones/schema.

### Task 2 — Checkout e integración Web/documentación

Files: professional/components/SubscriptionPanel.tsx, professional/types/subscription.ts, professional/pages/ProfessionalPage.tsx, admin/components/ProfessionalDirectory.tsx, contratos/documentos de alcance.
- [x] Integrar Mi suscripción en navegación para cuentas con/sin plan y CTA del inicio. Consultar catálogo persistido, conservar interés de registro sin activación automática.
- [x] Añadir cotización, instrumentos demo, confirmación de importe, procesamiento, resultado/comprobante e historial. Persistir solo ID de operación/idempotencia para recuperar al recargar; sin datos financieros reales.
- [x] Mostrar rechazos/errores/cancelación y evitar doble envío. Revalidar panel después de aprobación. Directorio administrativo solo lectura.
- [x] Actualizar decisiones vigentes DEC005/014, HU011/012/039, contratos EP02/requirements/README sin alterar antecedentes históricos ni RF/RDF originales sin anotación.
- [x] Build/typecheck/lint/format, navegador con datos sintéticos: primera contratación, upgrade, fallos, recarga y admin sin controles.

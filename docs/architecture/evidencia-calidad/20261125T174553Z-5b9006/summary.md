# Resultado de pruebas: fallida

Corrida `20261125T174553Z-5b9006` | commit `f42a1f3303098d96c257b76b649956c0fa0dca1f-dirty` | rama `main` | entorno local | duración 23.2 s

## Totales

| | Total | Aprobadas | Fallidas | Omitidas | Bloqueadas | % aprobación |
| --- | --- | --- | --- | --- | --- | --- |
| Total | 276 | 112 | 164 | 0 | 0 | 40.58 |

## Por suite

| | Total | Aprobadas | Fallidas | Omitidas | Bloqueadas | % aprobación |
| --- | --- | --- | --- | --- | --- | --- |
| api | 276 | 112 | 164 | 0 | 0 | 40.58 |

## Por tipo

| | Total | Aprobadas | Fallidas | Omitidas | Bloqueadas | % aprobación |
| --- | --- | --- | --- | --- | --- | --- |
| e2e | 35 | 0 | 35 | 0 | 0 | 0 |
| integración | 140 | 23 | 117 | 0 | 0 | 16.43 |
| unitaria | 82 | 82 | 0 | 0 | 0 | 100 |
| seguridad | 8 | 0 | 8 | 0 | 0 | 0 |
| recuperación | 11 | 7 | 4 | 0 | 0 | 63.64 |

## Pruebas fallidas o bloqueadas

- [fallida] api: credentials require current password, reject identity manipulation and duplicates, revoke all sessions and preserve record - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: invitation ownership, active state, CSRF, replacement, revoke and minimal prevalidation - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: invitation and activation enforce server expiration and current professional, subscription and record states - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: anonymous activation at the reserved last place is atomic, authenticated, notice-versioned and deletes the hash; replay fails - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: invalid activation, occupied username/email and forged fields preserve the original invitation - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: two simultaneous redemptions produce exactly one account and one link - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: reserved clients remain invitable after downgrade over capacity and concurrent issue does not deadlock across records - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: missing/expired subscription blocks invitation issuance and hides the professional portfolio - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: invitation replacement racing redemption yields only committed valid outcomes - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: failure at each activation stage rolls account, linkage, notice, deletion and audit back together - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: session failure after activation commit preserves account and offers ordinary login - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: assisted recovery requires ownership, corroboration and operator reauthentication; replaces and consumes reset and revokes every old session - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: reset expiry at server boundary, replay, concurrent consumption and invitation separation - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: reset failure rolls back consumption, password and revocation - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: admin may authorize professional and other admin recovery, never self; public reset does not enumerate accounts - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: custodian command requires privileged connection and only the last active admin - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: runtime context resets after transactions and cannot change arbitrary credentials, role or delete users - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: daily cleanup removes only expired codes with runtime permissions and preserves live invitations and resets - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: apps/api/tests/account-lifecycle.test.ts - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: admin support lists, views with a logged reason, resets a linked client and cannot edit anything - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: apps/api/tests/admin-support.test.ts - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HTTP authorization matrix limits admin, professional, and client access - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: request roles and JWT claims do not grant administrator permissions - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: admin refresh rejects replay and logout or deactivation invalidates sessions - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: manual seed reveals its password once and runtime cannot provision accounts - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: professionals see available plans and admin is read only for subscriptions - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: approval activates once, charges full new price and starts a new calendar month - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: decline, processor error and cancellation preserve the prior subscription - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: idempotency, owner isolation, forged inputs and simultaneous finalization - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: expired or obsolete quotes never activate and audit failure rolls back the payment - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: catalog edits propagate to public, professional, registration interest and checkout without fixed prices - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: apps/api/tests/checkout.test.ts - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: linked active client logs in by username or email and accesses record without activation code - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: post-activation flow allows subsequent logins without ever asking or accepting an invitation code - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: wrong password, missing user, inactive client, unlinked client, professional, and admin return identical 401 on client login - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: role isolation prevents professional/admin from acquiring client functions and client from accessing professional/admin routes - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: disabling client account revokes open session and reactivation does not revive it - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: client refresh rotates token pair and replay revokes the session family - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: client logout revokes the session and prevents subsequent access or refresh - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: forged or malformed Bearer tokens return 401 - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: restricted runtime role couchone_authentication can authenticate clients and read their profile without destructive permissions - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: apps/api/tests/client-login.test.ts - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HU-019 composition reuses the real owned base profile and never fabricates unintegrated module records - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HU-019 role, ownership and injected query failures return no composed record - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HU-019 failure of the available profile query is a safe error, never empty or partial success - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: ordinary LOGIN without a valid subject cannot read clients or base measurements - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: each professional reads only their own portfolio and all foreign physical measures stay invisible - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HU-021 evaluation rows are append-only, isolated by owner and readable for inactive owned records - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HU-021 HTTP creates idempotent dated evaluations, lists history and composes it only for the owning professional - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- [fallida] api: HU-021 HTTP persists every offered method with server identity, dates and replay protection - [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1
- ... y 114 más

## Archivos sin trazabilidad a requisitos

- apps/api/tests/catalog-search.test.ts

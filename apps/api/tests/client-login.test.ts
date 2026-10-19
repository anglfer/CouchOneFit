import { argon2id, hash } from 'argon2';
import type { Express } from 'express';
import { SignJWT, decodeJwt } from 'jose';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import request from 'supertest';

const run = randomBytes(4).toString('hex');
const password = 'ClaveCliente#2026';
let owner: Pool,
  pool: Pool,
  app: Express,
  dbName: string,
  professionalUserId: string,
  professionalRecordId: string,
  adminUserId: string,
  activeClientUserId: string,
  activeClientRecordId: string,
  inactiveClientUserId: string,
  unlinkedClientUserId: string,
  toggleClientUserId: string;

before(async () => {
  const value = process.env.TEST_DATABASE_URL;
  if (
    !value ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)
  )
    throw new Error('Se requiere TEST_DATABASE_URL local exclusiva de pruebas');
  dbName = `CouchOneFit_client_login_${run}`;
  owner = new Pool({ connectionString: value });
  await owner.query(`CREATE DATABASE "${dbName}"`);
  const target = new URL(value);
  target.pathname = `/${dbName}`;
  process.env.DATABASE_URL = target.toString();
  process.env.AUTH_JWT_SECRET =
    'secreto-pruebas-couchonefit-con-longitud-segura-2026';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  pool = new Pool({ connectionString: target.toString() });
  await pool.query(
    readFileSync(
      new URL(
        '../../../docs/database/schemas/identity_access.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const insertedUsers = await pool.query(
    `INSERT INTO private.users (username, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'professional', 'active'),
            ($4, $5, $3, 'admin', 'active'),
            ($6, $7, $3, 'client', 'active'),
            ($8, $9, $3, 'client', 'inactive'),
            ($10, $11, $3, 'client', 'active'),
            ($12, $13, $3, 'client', 'active')
     RETURNING id`,
    [
      `pro.cl.${run}`,
      `pro.cl.${run}@example.com`,
      passwordHash,
      `admin.cl.${run}`,
      `admin.cl.${run}@example.com`,
      `client.active.${run}`,
      `client.active.${run}@example.com`,
      `client.inactive.${run}`,
      `client.inactive.${run}@example.com`,
      `client.unlinked.${run}`,
      `client.unlinked.${run}@example.com`,
      `client.toggle.${run}`,
      `client.toggle.${run}@example.com`,
    ]
  );
  professionalUserId = insertedUsers.rows[0].id;
  adminUserId = insertedUsers.rows[1].id;
  activeClientUserId = insertedUsers.rows[2].id;
  inactiveClientUserId = insertedUsers.rows[3].id;
  unlinkedClientUserId = insertedUsers.rows[4].id;
  toggleClientUserId = insertedUsers.rows[5].id;

  const insertedProf = await pool.query(
    `INSERT INTO private.professionals (user_id, full_name, phone)
     VALUES ($1, 'Marco Entrenador', '5512345678')
     RETURNING id`,
    [professionalUserId]
  );
  professionalRecordId = insertedProf.rows[0].id;

  const insertedClients = await pool.query(
    `INSERT INTO private.clients (professional_id, user_id, full_name, goal, status)
     VALUES ($1, $2, 'Sofía Cliente', 'Mejorar resistencia y movilidad', 'active'),
            ($1, $3, 'Cliente Inactivo', 'Rehabilitación', 'inactive'),
            ($1, $4, 'Cliente Reactivable', 'Fuerza general', 'active')
     RETURNING id`,
    [
      professionalRecordId,
      activeClientUserId,
      inactiveClientUserId,
      toggleClientUserId,
    ]
  );
  activeClientRecordId = insertedClients.rows[0].id;
  app = (await import('../src/app.js')).createApp(pool);
});

after(async () => {
  await pool?.end();
  if (dbName) await owner?.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await owner?.end();
});

const clientLogin = (
  identifier = `client.active.${run}`,
  secret = password,
  extra: Record<string, unknown> = {}
) =>
  request(app)
    .post('/api/auth/client/login')
    .send({ identifier, password: secret, ...extra });

test('linked active client logs in by username or email and accesses record without activation code', async () => {
  for (const identifier of [
    `  CLIENT.ACTIVE.${run} `,
    `CLIENT.ACTIVE.${run}@EXAMPLE.COM `,
  ]) {
    const response = await clientLogin(identifier);
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body.account, {
      id: activeClientUserId,
      clientId: activeClientRecordId,
      username: `client.active.${run}`,
      email: `client.active.${run}@example.com`,
      fullName: 'Sofía Cliente',
      role: 'client',
      status: 'active',
      clientStatus: 'active',
    });
    assert.match(response.body.session.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.match(response.body.session.refreshToken, /^[\w-]{43}$/);
    assert.equal(
      Number.isNaN(Date.parse(response.body.session.expiresAt)),
      false
    );
    assert.equal(JSON.stringify(response.body).includes('password'), false);

    const token = response.body.session.accessToken as string;
    const sessionCheck = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(sessionCheck.status, 200);
    assert.deepEqual(sessionCheck.body.account, response.body.account);

    const profileCheck = await request(app)
      .get('/api/client/profile')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(profileCheck.status, 200);
    assert.deepEqual(profileCheck.body.profile, {
      id: activeClientRecordId,
      userId: activeClientUserId,
      professionalId: professionalRecordId,
      fullName: 'Sofía Cliente',
      goal: 'Mejorar resistencia y movilidad',
      status: 'active',
      username: `client.active.${run}`,
      email: `client.active.${run}@example.com`,
    });
  }
});

test('post-activation flow allows subsequent logins without ever asking or accepting an invitation code', async () => {
  // 1. Professional creates an unlinked client record (before invitation is consumed)
  const {
    rows: [expediente],
  } = await pool.query(
    `INSERT INTO private.clients (professional_id, user_id, full_name, goal, status)
     VALUES ($1, NULL, 'Diego PostActivación', ' recomposición corporal ', 'active')
     RETURNING id`,
    [professionalRecordId]
  );
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  // 2. Invitation consumption links the newly activated client account to the client record
  const {
    rows: [activatedUser],
  } = await pool.query(
    `INSERT INTO private.users (username, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'client', 'active')
     RETURNING id`,
    [`diego.${run}`, `diego.${run}@example.com`, passwordHash]
  );
  await pool.query(`UPDATE private.clients SET user_id = $1 WHERE id = $2`, [
    activatedUser.id,
    expediente.id,
  ]);

  // 3. Passing an invitation code on login is rejected with 400
  for (const extra of [
    { code: 'INV-123456' },
    { invitationCode: 'INV-123456' },
    { role: 'client' },
  ]) {
    const rejected = await clientLogin(`diego.${run}`, password, extra);
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error.code, 'INVALID_LOGIN');
  }

  // 4. Subsequent logins with credentials alone succeed and reach the linked client record
  const firstLogin = await clientLogin(`diego.${run}`, password);
  assert.equal(firstLogin.status, 200);
  assert.equal(firstLogin.body.account.clientId, expediente.id);

  const secondLogin = await clientLogin(`diego.${run}@example.com`, password);
  assert.equal(secondLogin.status, 200);
  const profile = await request(app)
    .get('/api/client/profile')
    .set('Authorization', `Bearer ${secondLogin.body.session.accessToken}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.profile.id, expediente.id);
  assert.equal(profile.body.profile.fullName, 'Diego PostActivación');
});

test('wrong password, missing user, inactive client, unlinked client, professional, and admin return identical 401 on client login', async () => {
  const responses = [
    await clientLogin(`client.active.${run}`, 'clave-incorrecta-123'),
    await clientLogin(`inexistente.${run}`, password),
    await clientLogin(`client.inactive.${run}`, password),
    await clientLogin(`client.unlinked.${run}`, password),
    await clientLogin(`pro.cl.${run}`, password),
    await clientLogin(`admin.cl.${run}`, password),
  ];
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
    assert.deepEqual(response.body, responses[0].body);
  }
});

test('role isolation prevents professional/admin from acquiring client functions and client from accessing professional/admin routes', async () => {
  const clientRes = await clientLogin();
  const clientToken = clientRes.body.session.accessToken as string;

  // Client with Bearer token gets 403 ROLE_FORBIDDEN on professional and admin endpoints
  for (const path of ['/api/professional/profile', '/api/admin/session']) {
    const forbidden = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${clientToken}`);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'ROLE_FORBIDDEN');
  }

  // Professional and Admin tokens get 403 ROLE_FORBIDDEN on /api/client/profile
  const csrf = await request(app).get('/api/auth/csrf');
  const csrfCookie = (csrf.headers['set-cookie'] as string[])[0].split(';')[0];
  const csrfToken = csrf.body.csrfToken as string;

  for (const identifier of [`pro.cl.${run}`, `admin.cl.${run}`]) {
    const webLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ identifier, password });
    assert.equal(webLogin.status, 200);
    const accessCookie = (webLogin.headers['set-cookie'] as string[])
      .find((item) => item.startsWith('cof_access='))!
      .split(';')[0];
    const rawAccessToken = accessCookie.slice('cof_access='.length);

    const cookieAttempt = await request(app)
      .get('/api/client/profile')
      .set('Cookie', accessCookie);
    assert.equal(cookieAttempt.status, 403);
    assert.equal(cookieAttempt.body.error.code, 'ROLE_FORBIDDEN');

    const bearerAttempt = await request(app)
      .get('/api/client/profile')
      .set('Authorization', `Bearer ${rawAccessToken}`);
    assert.equal(bearerAttempt.status, 403);
    assert.equal(bearerAttempt.body.error.code, 'ROLE_FORBIDDEN');
  }
});

test('disabling client account revokes open session and reactivation does not revive it', async () => {
  const loginRes = await clientLogin(`client.toggle.${run}`);
  assert.equal(loginRes.status, 200);
  const { accessToken, refreshToken } = loginRes.body.session;

  try {
    await pool.query(
      `UPDATE private.users SET status = 'inactive' WHERE id = $1`,
      [toggleClientUserId]
    );
    assert.equal(
      (
        await request(app)
          .get('/api/client/profile')
          .set('Authorization', `Bearer ${accessToken}`)
      ).status,
      401
    );
    assert.equal(
      (
        await request(app)
          .post('/api/auth/client/refresh')
          .send({ refreshToken })
      ).status,
      401
    );
  } finally {
    await pool.query(
      `UPDATE private.users SET status = 'active' WHERE id = $1`,
      [toggleClientUserId]
    );
  }

  // Even after account is reactivated, the previously revoked session cannot be restored
  assert.equal(
    (
      await request(app)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
    ).status,
    401
  );
  assert.equal(
    (await request(app).post('/api/auth/client/refresh').send({ refreshToken }))
      .status,
    401
  );
});

test('client refresh rotates token pair and replay revokes the session family', async () => {
  const initial = await clientLogin();
  assert.equal(initial.status, 200);
  const firstAccess = initial.body.session.accessToken as string;
  const firstRefresh = initial.body.session.refreshToken as string;
  const claims = decodeJwt(firstAccess);

  const rotated = await request(app)
    .post('/api/auth/client/refresh')
    .send({ refreshToken: firstRefresh });
  assert.equal(rotated.status, 200);
  const secondAccess = rotated.body.session.accessToken as string;
  const secondRefresh = rotated.body.session.refreshToken as string;
  assert.notEqual(secondRefresh, firstRefresh);

  const {
    rows: [session],
  } = await pool.query('SELECT * FROM private.sessions WHERE id = $1', [
    claims.sid,
  ]);
  assert.equal(
    new Date(session.expires_at).getTime() -
      new Date(session.created_at).getTime(),
    30 * 86400000
  );

  // Replaying the already consumed refresh token returns 401 and revokes the session family
  const replay = await request(app)
    .post('/api/auth/client/refresh')
    .send({ refreshToken: firstRefresh });
  assert.equal(replay.status, 401);

  const afterReplay = await request(app)
    .get('/api/client/profile')
    .set('Authorization', `Bearer ${secondAccess}`);
  assert.equal(afterReplay.status, 401);
});

test('client logout revokes the session and prevents subsequent access or refresh', async () => {
  const loginRes = await clientLogin();
  const { accessToken, refreshToken } = loginRes.body.session;

  const logoutRes = await request(app)
    .post('/api/auth/client/logout')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ refreshToken });
  assert.equal(logoutRes.status, 204);

  assert.equal(
    (
      await request(app)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
    ).status,
    401
  );
  assert.equal(
    (await request(app).post('/api/auth/client/refresh').send({ refreshToken }))
      .status,
    401
  );
});

test('forged or malformed Bearer tokens return 401', async () => {
  assert.equal(
    (
      await request(app)
        .get('/api/client/profile')
        .set('Authorization', 'Basic abc')
    ).status,
    401
  );
  const loginRes = await clientLogin();
  const claims = decodeJwt(loginRes.body.session.accessToken);
  const key = new TextEncoder().encode(process.env.AUTH_JWT_SECRET);
  for (const changes of [
    { exp: 1 },
    { sid: randomUUID() },
    { sub: adminUserId },
  ]) {
    const forged = await new SignJWT({ ...claims, ...changes })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(key);
    assert.equal(
      (
        await request(app)
          .get('/api/client/profile')
          .set('Authorization', `Bearer ${forged}`)
      ).status,
      401
    );
  }
});

test('restricted runtime role couchone_authentication can authenticate clients and read their profile without destructive permissions', async () => {
  const roleName = `client_runtime_${run}`;
  await pool.query(
    `CREATE ROLE ${roleName} LOGIN PASSWORD 'clave-runtime-segura'`
  );
  await pool.query(`GRANT couchone_authentication TO ${roleName}`);
  const target = new URL(process.env.DATABASE_URL!);
  target.username = roleName;
  target.password = 'clave-runtime-segura';
  const restrictedPool = new Pool({ connectionString: target.toString() });
  const restrictedApp = (await import('../src/app.js')).createApp(
    restrictedPool
  );
  try {
    const loginRes = await request(restrictedApp)
      .post('/api/auth/client/login')
      .send({ identifier: `client.active.${run}`, password });
    assert.equal(loginRes.status, 200);

    const profileRes = await request(restrictedApp)
      .get('/api/client/profile')
      .set('Authorization', `Bearer ${loginRes.body.session.accessToken}`);
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.profile.id, activeClientRecordId);

    const refreshRes = await request(restrictedApp)
      .post('/api/auth/client/refresh')
      .send({ refreshToken: loginRes.body.session.refreshToken });
    assert.equal(refreshRes.status, 200);

    const logoutRes = await request(restrictedApp)
      .post('/api/auth/client/logout')
      .send({ refreshToken: refreshRes.body.session.refreshToken });
    assert.equal(logoutRes.status, 204);

    await assert.rejects(restrictedPool.query('DELETE FROM private.clients'));
    await assert.rejects(restrictedPool.query('DELETE FROM private.users'));
  } finally {
    await restrictedPool.end();
    await pool.query(`DROP ROLE ${roleName}`);
  }
});

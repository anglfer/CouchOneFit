import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/main.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Map<String, Object?> sampleAccount({
    String role = 'client',
    String status = 'active',
  }) =>
      <String, Object?>{
        'id': '00000000-0000-4000-8000-000000000010',
        'clientId': '00000000-0000-4000-8000-000000000020',
        'username': 'sofia.fit',
        'email': 'sofia.fit@example.com',
        'fullName': 'Sofía Cliente',
        'role': role,
        'status': status,
        'clientStatus': status,
      };

  Map<String, Object?> sampleProfile() => <String, Object?>{
        'id': '00000000-0000-4000-8000-000000000020',
        'userId': '00000000-0000-4000-8000-000000000010',
        'professionalId': '00000000-0000-4000-8000-000000000030',
        'fullName': 'Sofía Cliente',
        'goal': 'Mejorar resistencia y movilidad',
        'status': 'active',
        'username': 'sofia.fit',
        'email': 'sofia.fit@example.com',
      };

  Map<String, Object?> sampleSession({
    String accessToken = 'access.jwt.token1',
    String refreshToken = 'refresh_token_1234567890123456789012345678901',
  }) =>
      <String, Object?>{
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresAt': '2026-11-18T12:00:00.000Z',
      };

  testWidgets(
      'Cliente vinculado y activo inicia sesión sin pedir código y nunca se almacena la contraseña',
      (tester) async {
    final storage = InMemorySessionStorage();
    ApiHttpRequest? capturedLoginRequest;

    final apiClient = ApiClient(
      sessionStorage: storage,
      httpHandler: (request) async {
        if (request.method == 'POST' &&
            request.path == '/api/auth/client/login') {
          capturedLoginRequest = request;
          return ApiHttpResponse(
            statusCode: 200,
            body: <String, Object?>{
              'account': sampleAccount(),
              'session': sampleSession(),
            },
          );
        }
        if (request.method == 'GET' && request.path == '/api/client/profile') {
          expect(request.headers['Authorization'], 'Bearer access.jwt.token1');
          return ApiHttpResponse(
            statusCode: 200,
            body: <String, Object?>{'profile': sampleProfile()},
          );
        }
        return const ApiHttpResponse(statusCode: 404);
      },
    );

    await tester.pumpWidget(
      CouchOneFitApp(
        sessionStorage: storage,
        apiClient: apiClient,
      ),
    );
    await tester.pumpAndSettle();

    // Never asks for an activation or invitation code on the login screen
    expect(find.textContaining('Código'), findsNothing);
    expect(find.textContaining('código'), findsNothing);
    expect(find.text('Iniciar sesión'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('login_identifier_field')),
      'sofia.fit@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('login_password_field')),
      'ClaveSuperSecreta#2026',
    );
    await tester.tap(find.byKey(const ValueKey('login_submit_button')));
    await tester.pumpAndSettle();

    // Enters client profile (expediente)
    expect(find.text('Mi expediente'), findsOneWidget);
    expect(find.text('Sofía Cliente'), findsOneWidget);
    expect(find.text('@sofia.fit'), findsOneWidget);
    expect(find.text('Mejorar resistencia y movilidad'), findsOneWidget);

    // Payload sent only identifier and password, never code
    expect(capturedLoginRequest?.body?.keys.toSet(), {'identifier', 'password'});

    // Storage holds tokens only, never the password
    final storedRaw = storage.rawEntries.values.join(' ');
    expect(storedRaw.contains('ClaveSuperSecreta#2026'), isFalse);
    expect(storedRaw.contains('password'), isFalse);
    final storedSession = await storage.readSession();
    expect(storedSession?.accessToken, 'access.jwt.token1');
  });

  testWidgets(
      'Reiniciar la app restaura sesión válida rotando el refresh token y nunca recupera una sesión ya revocada',
      (tester) async {
    final storage = InMemorySessionStorage(
      initialSession: StoredSession(
        accessToken: 'expired.access.token',
        refreshToken: 'valid_refresh_token_1234567890123456789012345',
        expiresAt: DateTime.utc(2026, 11, 18, 12),
      ),
    );
    var sessionRevokedOnServer = false;
    var refreshCallCount = 0;

    ApiClient buildClient() => ApiClient(
          sessionStorage: storage,
          httpHandler: (request) async {
            if (request.path == '/api/auth/session') {
              if (sessionRevokedOnServer ||
                  request.headers['Authorization'] !=
                      'Bearer rotated.access.token') {
                return const ApiHttpResponse(
                  statusCode: 401,
                  body: <String, Object?>{
                    'error': <String, Object?>{
                      'code': 'SESSION_REQUIRED',
                      'message': 'Tu sesión venció. Inicia sesión de nuevo.',
                    },
                  },
                );
              }
              return ApiHttpResponse(
                statusCode: 200,
                body: <String, Object?>{'account': sampleAccount()},
              );
            }
            if (request.path == '/api/auth/client/refresh') {
              refreshCallCount += 1;
              if (sessionRevokedOnServer) {
                return const ApiHttpResponse(
                  statusCode: 401,
                  body: <String, Object?>{
                    'error': <String, Object?>{
                      'code': 'SESSION_REQUIRED',
                      'message': 'Tu sesión venció. Inicia sesión de nuevo.',
                    },
                  },
                );
              }
              return ApiHttpResponse(
                statusCode: 200,
                body: <String, Object?>{
                  'account': sampleAccount(),
                  'session': sampleSession(
                    accessToken: 'rotated.access.token',
                    refreshToken:
                        'rotated_refresh_token_12345678901234567890123',
                  ),
                },
              );
            }
            if (request.path == '/api/client/profile') {
              if (sessionRevokedOnServer) {
                return const ApiHttpResponse(
                  statusCode: 401,
                  body: <String, Object?>{
                    'error': <String, Object?>{
                      'code': 'SESSION_REQUIRED',
                      'message': 'Tu sesión venció. Inicia sesión de nuevo.',
                    },
                  },
                );
              }
              return ApiHttpResponse(
                statusCode: 200,
                body: <String, Object?>{'profile': sampleProfile()},
              );
            }
            return const ApiHttpResponse(statusCode: 404);
          },
        );

    // 1. App startup with expired access token rotates via refresh token and enters expediente
    await tester.pumpWidget(
      CouchOneFitApp(
        key: const ValueKey('app_boot_1'),
        sessionStorage: storage,
        apiClient: buildClient(),
      ),
    );
    await tester.pumpAndSettle();

    expect(refreshCallCount, 1);
    expect(find.text('Mi expediente'), findsOneWidget);
    expect((await storage.readSession())?.accessToken, 'rotated.access.token');

    // 2. Server revokes session / disables account; refreshing expediente drops session and wipes storage
    sessionRevokedOnServer = true;
    await tester.tap(find.byKey(const ValueKey('refresh_profile_button')));
    await tester.pumpAndSettle();

    expect(find.text('Mi expediente'), findsNothing);
    expect(
      find.text('Tu sesión venció. Inicia sesión de nuevo.'),
      findsOneWidget,
    );
    expect(await storage.readSession(), isNull);

    // 3. Restarting the app does NOT recover the revoked session even if server is healthy again
    sessionRevokedOnServer = false;
    await tester.pumpWidget(
      CouchOneFitApp(
        key: const ValueKey('app_boot_2'),
        sessionStorage: storage,
        apiClient: buildClient(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Mi expediente'), findsNothing);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });

  testWidgets(
      'Cuentas profesional/admin y cuentas deshabilitadas no adquieren acceso al expediente cliente',
      (tester) async {
    final storage = InMemorySessionStorage();
    var mode = 'invalid_credentials';

    final apiClient = ApiClient(
      sessionStorage: storage,
      httpHandler: (request) async {
        if (request.path == '/api/auth/client/login') {
          if (mode == 'invalid_credentials') {
            return const ApiHttpResponse(
              statusCode: 401,
              body: <String, Object?>{
                'error': <String, Object?>{
                  'code': 'INVALID_CREDENTIALS',
                  'message': 'Usuario, correo o contraseña incorrectos.',
                },
              },
            );
          }
          return ApiHttpResponse(
            statusCode: 200,
            body: <String, Object?>{
              'account': sampleAccount(role: 'professional'),
              'session': sampleSession(),
            },
          );
        }
        return const ApiHttpResponse(statusCode: 404);
      },
    );

    await tester.pumpWidget(
      CouchOneFitApp(
        sessionStorage: storage,
        apiClient: apiClient,
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('login_identifier_field')),
      'inactivo@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('login_password_field')),
      'Clave#2026',
    );
    await tester.ensureVisible(find.byKey(const ValueKey('login_submit_button')));
    await tester.tap(find.byKey(const ValueKey('login_submit_button')));
    await tester.pumpAndSettle();

    expect(
      find.text('Usuario, correo o contraseña incorrectos.'),
      findsOneWidget,
    );
    expect(find.text('Mi expediente'), findsNothing);
    expect(await storage.readSession(), isNull);

    // Even if an unexpected non-client role payload were returned, mobile rejects it with 403
    mode = 'professional_payload';
    await tester.ensureVisible(find.byKey(const ValueKey('login_submit_button')));
    await tester.tap(find.byKey(const ValueKey('login_submit_button')));
    await tester.pumpAndSettle();

    expect(
      find.text('Tu cuenta no tiene acceso a esta área.'),
      findsOneWidget,
    );
    expect(find.text('Mi expediente'), findsNothing);
    expect(await storage.readSession(), isNull);
  });
}

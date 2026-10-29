import 'dart:async';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/screens/account_access_screen.dart';
import 'package:couchonefit_mobile/features/auth/services/auth_service.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const password = ' contraseña 🔐 de prueba ';
  final code = 'a' * 43;
  Future<void> open(
      WidgetTester tester, AccountAccessMode mode, JsonHttpHandler handler,
      {InMemorySessionStorage? storage}) async {
    final sessionStorage = storage ?? InMemorySessionStorage();
    final service = AuthService(
        apiClient:
            ApiClient(sessionStorage: sessionStorage, httpHandler: handler),
        sessionStorage: sessionStorage);
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: Builder(
                builder: (context) => TextButton(
                    onPressed: () => Navigator.push<String>(
                        context,
                        MaterialPageRoute(
                            builder: (_) => AccountAccessScreen(
                                mode: mode, authService: service))),
                    child: const Text('Abrir'))))));
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();
  }

  Future<void> fill(WidgetTester tester, String key, String value) async {
    final field = find.byKey(Key('access-$key'));
    await tester.ensureVisible(field);
    await tester.enterText(field, value);
    await tester.pump();
  }

  testWidgets(
      'activation sends confirmations and version, never physical data; duplicate failure keeps form retryable',
      (tester) async {
    ApiHttpRequest? captured;
    var calls = 0;
    await open(tester, AccountAccessMode.activation, (request) async {
      captured = request;
      calls++;
      return const ApiHttpResponse(statusCode: 409, body: {
        'error': {
          'code': 'IDENTIFIER_UNAVAILABLE',
          'message': 'El usuario o correo no está disponible.'
        }
      });
    });
    expect(find.text('Peso inicial'), findsNothing);
    await fill(tester, 'code', code);
    await fill(tester, 'username', 'cliente.fit');
    await fill(tester, 'email', 'cliente@example.com');
    await fill(tester, 'emailConfirmation', 'cliente@example.com');
    await fill(tester, 'password', password);
    await fill(tester, 'passwordConfirmation', 'no coincide');
    await tester
        .ensureVisible(find.widgetWithText(FilledButton, 'Activar mi cuenta'));
    await tester.tap(find.widgetWithText(FilledButton, 'Activar mi cuenta'));
    await tester.pumpAndSettle();
    expect(calls, 0);
    await fill(tester, 'passwordConfirmation', password);
    await tester.ensureVisible(find.byType(CheckboxListTile));
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    await tester
        .ensureVisible(find.widgetWithText(FilledButton, 'Activar mi cuenta'));
    await tester.tap(find.widgetWithText(FilledButton, 'Activar mi cuenta'));
    await tester.pumpAndSettle();
    expect(captured!.path, '/api/auth/activation');
    expect(captured!.body!.keys.toSet(), {
      'code',
      'username',
      'email',
      'emailConfirmation',
      'password',
      'passwordConfirmation',
      'noticeVersion',
      'acceptsNotice'
    });
    expect(captured!.body!['password'], password);
    expect(captured!.body!['acceptsNotice'], true);
    expect(captured!.body!['noticeVersion'], '2026-10-15.1');
    expect(
        find.text('El usuario o correo no está disponible.'), findsOneWidget);
    expect(
        find.widgetWithText(FilledButton, 'Activar mi cuenta'), findsOneWidget);
  });
  testWidgets(
      'activation transport error preserves fields without automatic retry',
      (tester) async {
    var calls = 0;
    await open(tester, AccountAccessMode.activation, (request) async {
      calls++;
      return const ApiHttpResponse(statusCode: 503, body: {
        'error': {
          'code': 'SERVICE_UNAVAILABLE',
          'message': 'No pudimos completar la solicitud.'
        }
      });
    });
    await fill(tester, 'code', code);
    await fill(tester, 'username', 'cliente.fit');
    await fill(tester, 'email', 'cliente@example.com');
    await fill(tester, 'emailConfirmation', 'cliente@example.com');
    await fill(tester, 'password', password);
    await fill(tester, 'passwordConfirmation', password);
    await tester.ensureVisible(find.byType(CheckboxListTile));
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    final submit = find.widgetWithText(FilledButton, 'Activar mi cuenta');
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.text('No pudimos completar la solicitud.'), findsOneWidget);
    for (final entry in {
      'code': code,
      'username': 'cliente.fit',
      'email': 'cliente@example.com',
      'password': password,
    }.entries) {
      final field =
          tester.widget<TextFormField>(find.byKey(Key('access-${entry.key}')));
      expect(field.controller!.text, entry.value);
    }
    expect(tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
        isTrue);
    expect(tester.widget<FilledButton>(submit).onPressed, isNotNull);
  });
  testWidgets(
      'prevalidation does not submit activation and loading blocks duplicate requests',
      (tester) async {
    final pending = Completer<ApiHttpResponse>();
    var calls = 0;
    await open(tester, AccountAccessMode.activation, (request) {
      calls++;
      expect(request.path, '/api/auth/activation/prevalidate');
      expect(request.body, {'code': code});
      return pending.future;
    });
    await fill(tester, 'code', code);
    final button = find.text('Comprobar código');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
    await tester.tap(button);
    await tester.pump();
    expect(calls, 1);
    pending.complete(
        const ApiHttpResponse(statusCode: 200, body: {'valid': true}));
    await tester.pumpAndSettle();
    expect(find.text('El código está disponible. Comprobarlo no lo consume.'),
        findsOneWidget);
  });
  testWidgets(
      'recovery presents assisted procedure and submits only code and new password confirmations',
      (tester) async {
    ApiHttpRequest? captured;
    await open(tester, AccountAccessMode.recovery, (request) async {
      captured = request;
      return const ApiHttpResponse(statusCode: 204);
    });
    expect(find.textContaining('código de recuperación válido por 30 minutos'),
        findsOneWidget);
    await fill(tester, 'code', code);
    await fill(tester, 'password', password);
    await fill(tester, 'passwordConfirmation', password);
    await tester.ensureVisible(find.text('Guardar cambios'));
    await tester.tap(find.text('Guardar cambios'));
    await tester.pumpAndSettle();
    expect(captured!.path, '/api/auth/recovery/reset');
    expect(captured!.body!.keys.toSet(),
        {'code', 'password', 'passwordConfirmation'});
    expect(find.text('Abrir'), findsOneWidget);
  });
  testWidgets(
      'credential change failure preserves local session and success clears it',
      (tester) async {
    final storage = InMemorySessionStorage();
    final api = ApiClient(
        sessionStorage: storage,
        httpHandler: (request) async {
          expect(request.path, '/api/me/credentials');
          expect(request.method, 'PATCH');
          return const ApiHttpResponse(statusCode: 403, body: {
            'error': {
              'code': 'REAUTHENTICATION_FAILED',
              'message': 'No pudimos confirmar tu contraseña actual.'
            }
          });
        });
    // A business rejection must not erase a valid session.
    final sessionJson = {
      'accessToken': 'access',
      'refreshToken': 'refresh',
      'expiresAt':
          DateTime.now().toUtc().add(const Duration(days: 1)).toIso8601String()
    };
    await storage.saveSession(StoredSession.fromJson(sessionJson));
    final service = AuthService(apiClient: api, sessionStorage: storage);
    await expectLater(
        service.changeCredentials({
          'username': 'cliente.fit',
          'currentPassword': 'incorrecta',
          'password': password,
          'passwordConfirmation': password
        }),
        throwsA(isA<AuthApiException>()));
    expect(await storage.readSession(), isNotNull);
    final success = AuthService(
        apiClient: ApiClient(
            sessionStorage: storage,
            httpHandler: (_) async => const ApiHttpResponse(statusCode: 204)),
        sessionStorage: storage);
    await success.changeCredentials({
      'username': 'cliente.fit',
      'currentPassword': password,
      'password': password,
      'passwordConfirmation': password
    });
    expect(await storage.readSession(), isNull);
  });
}

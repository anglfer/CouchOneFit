import 'dart:convert';
import 'dart:io';
import 'package:couchonefit_mobile/main.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

// Only synthetic fixtures in a dedicated local PostgreSQL environment.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const baseUrl = String.fromEnvironment('API_BASE_URL',
      defaultValue: 'http://10.0.2.2:35412');
  const operatorName = String.fromEnvironment('QA_PROFESSIONAL_USERNAME',
      defaultValue: 'qa.lifecycle');
  const operatorPassword = String.fromEnvironment('QA_PROFESSIONAL_PASSWORD',
      defaultValue: 'ClaveLocalDePrueba2026');
  final cookies = <String, Cookie>{};
  String? csrf;
  Future<Map<String, dynamic>> api(String method, String path,
      {Map<String, Object?>? body, bool web = false, int status = 200}) async {
    if (!['10.0.2.2', '127.0.0.1', 'localhost']
        .contains(Uri.parse(baseUrl).host)) {
      throw StateError('Solo API local exclusiva de pruebas.');
    }
    final client = HttpClient();
    try {
      final req = await client.openUrl(method, Uri.parse('$baseUrl$path'));
      req.headers.contentType = ContentType.json;
      if (web) {
        req.cookies.addAll(cookies.values);
        req.headers.set('Origin', 'http://127.0.0.1:5412');
        if (csrf != null) req.headers.set('X-CSRF-Token', csrf!);
      }
      if (body != null) req.write(jsonEncode(body));
      final res = await req.close();
      for (final cookie in res.cookies) {
        cookies[cookie.name] = cookie;
      }
      final raw = await utf8.decoder.bind(res).join();
      expect(res.statusCode, status, reason: '$method $path');
      return raw.isEmpty ? {} : jsonDecode(raw) as Map<String, dynamic>;
    } finally {
      client.close();
    }
  }

  Future<void> waitFor(WidgetTester tester, Finder finder) async {
    for (var i = 0; i < 100; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      if (finder.evaluate().isNotEmpty) return;
    }
    expect(finder, findsOneWidget);
  }

  Future<void> fill(WidgetTester tester, String field, String value) async {
    final finder = find.byKey(Key('access-$field'));
    await tester.ensureVisible(finder);
    await tester.enterText(finder, value);
    await tester.pump();
  }

  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  testWidgets(
      'real Android activation, credential change and assisted recovery preserve one account and record',
      (tester) async {
    final csrfResult = await api('GET', '/api/auth/csrf', web: true);
    csrf = csrfResult['csrfToken'] as String;
    await api('POST', '/api/auth/login',
        web: true,
        body: {'identifier': operatorName, 'password': operatorPassword});
    final listing = await api('GET', '/api/clients', web: true);
    final records = (listing['clients'] as List).cast<Map<String, dynamic>>();
    final record = records.firstWhere(
        (item) => item['userId'] == null && item['status'] == 'active');
    final invite = await api('POST', '/api/clients/${record['id']}/invitations',
        web: true, body: {}, status: 201);
    final suffix = DateTime.now().millisecondsSinceEpoch.toString();
    final username = 'android.$suffix';
    const initialPassword = 'ClaveAndroidInicial2026';
    const newPassword = 'ClaveAndroidCambiada2026';
    const recoveredPassword = 'ClaveAndroidRecuperada2026';
    final storage = MethodChannelSessionStorage();
    await storage.clearSession();
    await tester.pumpWidget(CouchOneFitApp(sessionStorage: storage));
    await tester.pumpAndSettle();
    await tap(tester, find.text('Activar mi cuenta'));
    await fill(tester, 'code', invite['code'] as String);
    await fill(tester, 'username', username);
    await fill(tester, 'email', '$username@example.com');
    await fill(tester, 'emailConfirmation', '$username@example.com');
    await fill(tester, 'password', initialPassword);
    await fill(tester, 'passwordConfirmation', initialPassword);
    await tap(tester, find.byType(CheckboxListTile));
    await tap(tester, find.text('Activar cuenta'));
    await waitFor(tester, find.text('Mi expediente'));
    expect(find.text(record['fullName'] as String), findsOneWidget);
    final firstSession = await storage.readSession();
    expect(firstSession, isNotNull);
    // Recreate the app with the persisted native secure store, not a fake session.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
    await tester.pumpWidget(const CouchOneFitApp());
    await tester.pumpAndSettle();
    await waitFor(tester, find.text('Mi expediente'));
    await tap(tester, find.text('Cambiar mis credenciales'));
    await fill(tester, 'username', username);
    await fill(tester, 'currentPassword', initialPassword);
    await fill(tester, 'password', newPassword);
    await fill(tester, 'passwordConfirmation', newPassword);
    await tap(tester, find.text('Guardar credenciales'));
    await waitFor(tester, find.byKey(const Key('login_identifier_field')));
    await tester.enterText(
        find.byKey(const Key('login_identifier_field')), username);
    await tester.enterText(
        find.byKey(const Key('login_password_field')), newPassword);
    await tap(tester, find.byKey(const Key('login_submit_button')));
    await waitFor(tester, find.text('Mi expediente'));
    await tap(tester, find.text('Cerrar sesión'));
    await waitFor(tester, find.byKey(const Key('login_identifier_field')));
    final targets =
        await api('GET', '/api/accounts/recovery-targets', web: true);
    final target = (targets['accounts'] as List)
        .cast<Map<String, dynamic>>()
        .firstWhere((item) => item['username'] == username);
    final reset = await api('POST', '/api/accounts/${target['id']}/recovery',
        web: true,
        status: 201,
        body: {
          'identityVerified': true,
          'verificationMethod': 'known_relationship',
          'currentPassword': operatorPassword
        });
    await tap(tester, find.text('Recuperar mi acceso'));
    await fill(tester, 'code', reset['code'] as String);
    await fill(tester, 'password', recoveredPassword);
    await fill(tester, 'passwordConfirmation', recoveredPassword);
    await tap(tester, find.text('Guardar credenciales'));
    await waitFor(tester, find.byKey(const Key('login_identifier_field')));
    await tester.enterText(
        find.byKey(const Key('login_identifier_field')), username);
    await tester.enterText(
        find.byKey(const Key('login_password_field')), recoveredPassword);
    await tap(tester, find.byKey(const Key('login_submit_button')));
    await waitFor(tester, find.text('Mi expediente'));
    expect(find.text(record['fullName'] as String), findsOneWidget);
    final updated = await api('GET', '/api/clients', web: true);
    final same = (updated['clients'] as List)
        .cast<Map<String, dynamic>>()
        .singleWhere((item) => item['id'] == record['id']);
    expect(same['userId'], target['id']);
    expect(same['invitationExpiresAt'], isNull);
  });
}

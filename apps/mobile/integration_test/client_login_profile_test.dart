import 'dart:io';

import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/main.dart';
import 'package:couchonefit_mobile/shared/services/api_config.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

// Existing, synthetic activated account only; never resets fixture credentials.
// Pass private QA values through an ignored --dart-define-from-file file.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const username = String.fromEnvironment('QA_CLIENT_USERNAME');
  const password = String.fromEnvironment('QA_CLIENT_PASSWORD');
  const fullName = String.fromEnvironment('QA_CLIENT_FULL_NAME');
  const goal = String.fromEnvironment('QA_CLIENT_GOAL');
  const baseUrl = String.fromEnvironment('API_BASE_URL');

  Future<void> waitFor(WidgetTester tester, Finder finder) async {
    final elapsed = Stopwatch()..start();
    while (elapsed.elapsed < const Duration(seconds: 90)) {
      await tester.pump(const Duration(milliseconds: 100));
      if (finder.evaluate().isNotEmpty) return;
    }
    expect(finder, findsOneWidget);
  }

  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  testWidgets('Android login, own record, refresh, native session and logout',
      (tester) async {
    expect(['10.0.2.2', '127.0.0.1', 'localhost'],
        contains(Uri.parse(baseUrl).host),
        reason: 'Only the dedicated local QA API is allowed.');
    expect(username, isNotEmpty);
    expect(password, isNotEmpty);
    expect(fullName, isNotEmpty);
    expect(goal, isNotEmpty);
    await ApiConfig.load();
    final storage = MethodChannelSessionStorage();
    await storage.clearSession();
    await tester.pumpWidget(CouchOneFitApp(sessionStorage: storage));
    await tester.pumpAndSettle();
    await tap(tester, find.text('Iniciar sesión'));
    await tester.enterText(
        find.byKey(const Key('login_identifier_field')), username);
    await tester.enterText(
        find.byKey(const Key('login_password_field')), password);
    await tap(tester, find.byKey(const Key('login_submit_button')));
    await waitFor(tester, find.text('Mi expediente'));
    expect(find.text(fullName), findsOneWidget);
    expect(find.text(goal), findsOneWidget);
    expect(await storage.readSession(), isNotNull);

    await binding.convertFlutterSurfaceToImage();
    await tester.pumpAndSettle();
    final screenshot = await binding.takeScreenshot('client-login-profile');
    await File('${Directory.systemTemp.path}/client-login-profile.png')
        .writeAsBytes(screenshot);

    await tap(tester, find.text('Actualizar expediente'));
    await waitFor(tester, find.text('Actualizar expediente'));
    expect(find.text(fullName), findsOneWidget);
    expect(find.text(goal), findsOneWidget);
    await tester.ensureVisible(find.text('Datos base preparados'));
    await tester.pumpAndSettle();
    expect(find.text('70.2 kg'), findsOneWidget);
    expect(find.text('170.5 cm'), findsOneWidget);
    expect(find.text('15/06/1990'), findsOneWidget);
    final measurements =
        await binding.takeScreenshot('client-base-measurements');
    await File('${Directory.systemTemp.path}/client-base-measurements.png')
        .writeAsBytes(measurements);

    // Recreate the app against Android's secure store, without a fake API/session.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
    final restoredStorage = MethodChannelSessionStorage();
    await tester.pumpWidget(CouchOneFitApp(sessionStorage: restoredStorage));
    await waitFor(tester, find.text('Mi expediente'));
    expect(find.text(fullName), findsOneWidget);
    await tap(tester, find.text('Cerrar sesión'));
    await waitFor(tester, find.text('Iniciar sesión'));
    // After a restored session, logout returns to the welcome screen.
    if (find.byKey(const Key('login_identifier_field')).evaluate().isEmpty) {
      await tap(tester, find.text('Iniciar sesión'));
    }
    await waitFor(tester, find.byKey(const Key('login_identifier_field')));
    expect(find.text(fullName), findsNothing);
    expect(await restoredStorage.readSession(), isNull);
    expect(await MethodChannelSessionStorage().readSession(), isNull);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:couchonefit_mobile/main.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';
import 'package:couchonefit_mobile/features/auth/screens/login_screen.dart';

void main() {
  testWidgets('CouchOneFitApp smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const CouchOneFitApp());

    // Verify that the title text is rendered.
    expect(find.text('CouchOne Fit'), findsOneWidget);
  });

  testWidgets('El botón alterna el tema móvil en ambas direcciones',
      (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await tester.pumpWidget(const CouchOneFitApp());
    await tester.tap(find.byTooltip('Cambiar a modo oscuro'));
    await tester.pumpAndSettle();
    expect(Theme.of(tester.element(find.text('CouchOne Fit'))).brightness,
        Brightness.dark);
    await tester.tap(find.byTooltip('Cambiar a modo claro'));
    await tester.pumpAndSettle();
    expect(Theme.of(tester.element(find.text('CouchOne Fit'))).brightness,
        Brightness.light);
  });

  for (final brightness in Brightness.values) {
    testWidgets('Acceso legible con teclado y texto grande en $brightness',
        (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      tester.platformDispatcher.textScaleFactorTestValue = 1.6;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
        tester.view.resetViewInsets();
        tester.platformDispatcher.clearTextScaleFactorTestValue();
      });
      await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(brightness),
        home: Scaffold(
            body: LoginScreen(
          isSubmitting: false,
          errorMessage: 'Usuario, correo o contraseña incorrectos.',
          statusMessage: 'Tu sesión venció. Inicia sesión de nuevo.',
          onSubmit: (_, __) async {},
          onActivate: () {},
          onRecover: () {},
        )),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      for (final target in [
        find.byKey(const ValueKey('login_identifier_field')),
        find.byKey(const ValueKey('login_password_field')),
        find.byKey(const ValueKey('login_submit_button')),
        find.text('Recuperar mi acceso'),
        find.text('Activar mi cuenta'),
      ]) {
        await tester.ensureVisible(target);
        await tester.pumpAndSettle();
        expect(target.hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });

    testWidgets('Aplica paleta móvil $brightness según dispositivo',
        (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      await tester.pumpWidget(const CouchOneFitApp());
      await tester.pumpAndSettle();
      final theme = Theme.of(tester.element(find.text('CouchOne Fit')));
      final dark = brightness == Brightness.dark;
      expect(theme.brightness, brightness);
      expect(theme.colorScheme.primary, Color(dark ? 0xFF4B40FF : 0xFF4037F7));
      expect(
          theme.scaffoldBackgroundColor, Color(dark ? 0xFF050A1A : 0xFFFBFBFD));
      expect(theme.colorScheme.surface, Color(dark ? 0xFF0C152C : 0xFFFFFFFF));
      expect(theme.colorScheme.error, BrandColors.error);
      expect(theme.cardTheme.shape, isA<RoundedRectangleBorder>());
      expect((theme.cardTheme.shape as RoundedRectangleBorder).borderRadius,
          BorderRadius.circular(12));
      expect(tester.takeException(), isNull);
    });
  }
}

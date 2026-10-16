import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:couchonefit_mobile/main.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';

void main() {
  testWidgets('CouchOneFitApp smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const CouchOneFitApp());

    // Verify that the title text is rendered.
    expect(find.text('CouchOne Fit - Móvil'), findsOneWidget);
  });

  testWidgets('El botón alterna el tema móvil en ambas direcciones',
      (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await tester.pumpWidget(const CouchOneFitApp());
    await tester.tap(find.byTooltip('Cambiar a modo oscuro'));
    await tester.pumpAndSettle();
    expect(
        Theme.of(tester.element(find.text('CouchOne Fit - Móvil'))).brightness,
        Brightness.dark);
    await tester.tap(find.byTooltip('Cambiar a modo claro'));
    await tester.pumpAndSettle();
    expect(
        Theme.of(tester.element(find.text('CouchOne Fit - Móvil'))).brightness,
        Brightness.light);
  });

  for (final brightness in Brightness.values) {
    testWidgets('Aplica paleta móvil $brightness según dispositivo',
        (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      await tester.pumpWidget(const CouchOneFitApp());
      await tester.pumpAndSettle();
      final theme = Theme.of(tester.element(find.text('CouchOne Fit - Móvil')));
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

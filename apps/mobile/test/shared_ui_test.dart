import 'dart:ui' show Tristate;

import 'package:couchonefit_mobile/features/training/screens/training_views.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';
import 'package:couchonefit_mobile/shared/widgets/detail_scaffold.dart';
import 'package:couchonefit_mobile/shared/widgets/gradient_widgets.dart';
import 'package:couchonefit_mobile/shared/widgets/notice_banner.dart';
import 'package:couchonefit_mobile/shared/widgets/sheet_parts.dart';
import 'package:couchonefit_mobile/shared/widgets/status_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
    theme: mobileTheme(Brightness.dark), home: Scaffold(body: child));

void main() {
  testWidgets('StatusView scrolls alone and also fits inside a list',
      (tester) async {
    const view = StatusView(title: 'Vacío', message: 'Sin datos');
    await tester.pumpWidget(host(view));
    expect(find.byType(SingleChildScrollView), findsOneWidget);
    await tester.pumpWidget(host(ListView(children: const [view])));
    expect(tester.takeException(), isNull);
    expect(find.text('Sin datos'), findsOneWidget);
  });

  testWidgets('NoticeBanner offers retry only with a callback', (tester) async {
    var retries = 0;
    await tester.pumpWidget(host(const NoticeBanner(text: 'Aviso')));
    expect(find.text('Reintentar'), findsNothing);
    await tester.pumpWidget(host(NoticeBanner(
        text: 'Falló', tone: NoticeTone.error, onRetry: () => retries++)));
    await tester.tap(find.text('Reintentar'));
    expect(retries, 1);
  });

  testWidgets('ChoiceBar reports the choice, its state and respects disabled',
      (tester) async {
    final handle = tester.ensureSemantics();
    final picked = <int>[];
    Widget bar(ValueChanged<int>? onChanged) => host(SizedBox(
        width: 360,
        child: ChoiceBar<int>(
            options: const [(1, 'Uno'), (2, 'Dos')],
            selected: 1,
            onChanged: onChanged)));
    await tester.pumpWidget(bar(picked.add));
    await tester.tap(find.text('Dos'));
    expect(picked, [2]);
    expect(find.byType(ChoiceChip), findsNothing);
    final data =
        tester.getSemantics(find.bySemanticsLabel('Uno')).getSemanticsData();
    expect(data.hasAction(SemanticsAction.tap), isTrue);
    expect(data.flagsCollection.isSelected, Tristate.isTrue);
    await tester.pumpWidget(bar(null));
    await tester.tap(find.text('Dos'));
    expect(picked, [2]);
    handle.dispose();
  });

  testWidgets('ChoiceBar falls back to chips when labels cannot fit',
      (tester) async {
    await tester.pumpWidget(host(SizedBox(
        width: 200,
        child: ChoiceBar<int>(
            options: const [(1, 'Entrenamiento'), (2, 'Alimentación')],
            selected: 1,
            onChanged: (_) {}))));
    expect(find.byType(ChoiceChip), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  for (final width in [240.0, 360.0]) {
    testWidgets('CardTitle keeps title and link usable at $width',
        (tester) async {
      var opened = 0;
      await tester.pumpWidget(host(Center(
          child: SizedBox(
              width: width,
              child: CardTitle(
                  icon: Icons.bar_chart_rounded,
                  title: 'Recuperación muscular',
                  action: 'Ver progreso',
                  onAction: () => opened++)))));
      expect(tester.takeException(), isNull);
      final title = tester.getCenter(find.text('Recuperación muscular')).dy;
      final link = tester.getCenter(find.text('Ver progreso')).dy;
      // The link shares the title row only when both fit in it.
      expect(link > title + 8, width < 300);
      await tester.tap(find.text('Ver progreso'));
      expect(opened, 1);
    });
  }

  testWidgets(
      'SheetOption marks the selection and SheetHeader closes the sheet',
      (tester) async {
    await tester.pumpWidget(host(Builder(
        builder: (context) => TextButton(
            onPressed: () => showModalBottomSheet<void>(
                context: context,
                builder: (_) =>
                    Column(mainAxisSize: MainAxisSize.min, children: [
                      const SheetHeader('Título', subtitle: 'Detalle'),
                      SheetOption(
                          title: 'Elegida',
                          leading: const Icon(Icons.check),
                          selected: true,
                          onTap: () {}),
                    ])),
            child: const Text('Abrir')))));
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    await tester.tap(find.byTooltip('Cerrar'));
    await tester.pumpAndSettle();
    expect(find.text('Título'), findsNothing);
  });

  testWidgets('status inks stay readable on the light surface', (tester) async {
    double ratio(Color a, Color b) {
      final (x, y) = (a.computeLuminance(), b.computeLuminance());
      return ((x > y ? x : y) + .05) / ((x > y ? y : x) + .05);
    }

    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: Builder(builder: (context) {
          for (final tone in [
            BrandColors.success,
            BrandColors.warning,
            BrandColors.error,
            BrandColors.highlight
          ]) {
            expect(ratio(statusInk(context, tone), Colors.white),
                greaterThanOrEqualTo(4.5));
          }
          for (final fill in [BrandColors.nightAction, actionFill(context)]) {
            expect(ratio(Colors.white, fill), greaterThanOrEqualTo(4.5));
          }
          return const SizedBox();
        })));
  });

  testWidgets('StatPanel pairs metrics and stacks them with large text',
      (tester) async {
    const panel = StatPanel(tiles: [
      StatTile(icon: Icons.repeat, label: 'Series', value: '12'),
      StatTile(icon: Icons.timer_outlined, label: 'Tiempo', value: '47:12'),
    ]);
    Future<double> gap() async {
      await tester.pumpWidget(host(const SizedBox(width: 360, child: panel)));
      expect(tester.takeException(), isNull);
      return tester.getTopLeft(find.text('Tiempo')).dy -
          tester.getTopLeft(find.text('Series')).dy;
    }

    expect(await gap(), 0);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    expect(await gap(), greaterThan(0));
  });

  testWidgets('inverse action is white, and translucent while disabled',
      (tester) async {
    Color? fill() => (tester
            .widget<AnimatedContainer>(find.byType(AnimatedContainer))
            .decoration as BoxDecoration)
        .color;
    await tester.pumpWidget(host(GradientActionButton(
        label: 'Empezar', inverse: true, onPressed: () {})));
    expect(fill(), Colors.white);
    await tester.pumpWidget(host(const GradientActionButton(
        label: 'Empezar', inverse: true, onPressed: null)));
    await tester.pumpAndSettle();
    expect(fill(), const Color(0x33FFFFFF));
  });

  for (final brightness in Brightness.values) {
    testWidgets('ChoiceBar(subtle: true) preserves semantics in $brightness',
        (tester) async {
      final handle = tester.ensureSemantics();
      final picked = <String>[];
      await tester.pumpWidget(MaterialApp(
          theme: mobileTheme(brightness),
          home: Scaffold(
              body: SizedBox(
                  width: 360,
                  child: ChoiceBar<String>(
                      subtle: true,
                      options: const [('a', 'Series'), ('b', 'Volumen')],
                      selected: 'a',
                      onChanged: picked.add)))));
      await tester.tap(find.text('Volumen'));
      expect(picked, ['b']);
      final data = tester
          .getSemantics(find.bySemanticsLabel('Series'))
          .getSemanticsData();
      expect(data.hasAction(SemanticsAction.tap), isTrue);
      expect(data.flagsCollection.isSelected, Tristate.isTrue);
      handle.dispose();
    });
  }

  testWidgets('StatTile(progress:) renders progress bar at 320px and 1.8x text',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    await tester.pumpWidget(host(const StatPanel(tiles: [
      StatTile(
          icon: Icons.event_available_outlined,
          label: 'Esta semana',
          value: '3 de 5',
          progress: 0.6),
      StatTile(
          icon: Icons.local_fire_department_outlined,
          label: 'Racha semanal',
          value: '2 semanas'),
    ])));
    await tester.pumpAndSettle();
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('DetailScaffold updates app bar divider cleanly on scroll',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: DetailScaffold(title: const Text('Detalle'), children: [
          for (var i = 0; i < 30; i++)
            Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('Elemento $i')),
        ])));
    expect(tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity,
        0);
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity,
        1);
    expect(tester.takeException(), isNull);
  });
}

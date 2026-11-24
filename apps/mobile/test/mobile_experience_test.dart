import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/screens/account_access_screen.dart';
import 'package:couchonefit_mobile/features/auth/screens/welcome_screen.dart';
import 'package:couchonefit_mobile/features/auth/screens/login_screen.dart';
import 'package:couchonefit_mobile/features/auth/services/auth_service.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/check_in/models/check_in.dart';
import 'package:couchonefit_mobile/features/check_in/services/check_in_service.dart';
import 'package:couchonefit_mobile/features/check_in/widgets/check_in_card.dart';
import 'package:couchonefit_mobile/features/check_in/widgets/follow_up_progress.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/client/screens/client_profile_screen.dart';
import 'package:couchonefit_mobile/features/nutrition/widgets/nutrition_plan_view.dart';
import 'package:couchonefit_mobile/features/training/models/training.dart';
import 'package:couchonefit_mobile/features/training/screens/progress_tab.dart';
import 'package:couchonefit_mobile/shared/animations/reveal_in.dart';
import 'package:couchonefit_mobile/shared/animations/tactile_bounce.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';
import 'package:couchonefit_mobile/shared/widgets/status_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const profile = ClientProfile(
  id: 'client',
  userId: 'user',
  professionalId: 'professional',
  fullName: 'Sofía Cliente',
  goal: 'Mejorar resistencia y movilidad',
  status: 'active',
  username: 'sofia.fit',
  email: 'sofia.fit@example.com',
);

void main() {
  testWidgets(
      'Reveal runs its real animation and reduced motion reveals immediately',
      (tester) async {
    Widget host(bool reduced) => MaterialApp(
        home: MediaQuery(
            data: MediaQueryData(disableAnimations: reduced),
            child: const RevealIn(child: Text('Contenido'))));
    await tester.pumpWidget(host(false));
    expect(tester.widget<Opacity>(find.byType(Opacity)).opacity, 0);
    await tester.pump(const Duration(milliseconds: 120));
    final middle = tester.widget<Opacity>(find.byType(Opacity)).opacity;
    expect(middle, greaterThan(0));
    expect(middle, lessThan(1));
    await tester.pumpWidget(host(true));
    expect(find.text('Contenido').hitTestable(), findsOneWidget);
    expect(find.byType(Opacity), findsNothing);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'Press feedback preserves the child tap and cancels without activating',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: Center(
                child: TactileBounce(
                    child: FilledButton(
                        onPressed: () => calls++,
                        child: const Text('Acción')))))));
    final button = find.byType(FilledButton);
    final gesture = await tester.startGesture(tester.getCenter(button));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 90));
    final transform = tester.widget<Transform>(find
        .descendant(
            of: find.byType(TactileBounce), matching: find.byType(Transform))
        .first);
    expect(transform.transform.storage[0], lessThan(1));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(calls, 1);
    final cancel = await tester.startGesture(tester.getCenter(button));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 90));
    await cancel.cancel();
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(tester.takeException(), isNull);
  });

  for (final brightness in Brightness.values) {
    for (final size in [
      const Size(320, 640),
      const Size(390, 844),
      const Size(768, 1024)
    ]) {
      for (final scale in [1.0, 1.8]) {
        testWidgets('Profile accessible at $size, text $scale, $brightness',
            (tester) async {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1;
          tester.platformDispatcher.textScaleFactorTestValue = scale;
          addTearDown(() {
            tester.view.resetPhysicalSize();
            tester.view.resetDevicePixelRatio();
            tester.platformDispatcher.clearTextScaleFactorTestValue();
          });
          var credentials = 0;
          await tester.pumpWidget(MaterialApp(
              theme: mobileTheme(brightness),
              home: Scaffold(
                  body: SafeArea(
                      child: ClientProfileScreen(
                          profile: profile,
                          onRefresh: () async {},
                          onLogout: () async {},
                          onCredentials: () => credentials++)))));
          await tester.pumpAndSettle();
          expect(find.text('Sofía Cliente'), findsOneWidget);
          expect(find.text('Mejorar resistencia y movilidad'), findsOneWidget);
          for (final label in [
            'Actualizar expediente',
            'Cerrar sesión',
            'Cambiar mis credenciales'
          ]) {
            await tester.ensureVisible(find.text(label));
            await tester.pumpAndSettle();
            expect(find.text(label).hitTestable(), findsOneWidget);
            expect(tester.takeException(), isNull);
          }
          await tester.tap(find.text('Cambiar mis credenciales'));
          expect(credentials, 1);
        });
      }
    }
  }

  testWidgets(
      'Pull to refresh awaits the request and keeps the profile visible',
      (tester) async {
    final request = Completer<void>();
    var refreshes = 0;
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: Scaffold(
            body: ClientProfileScreen(
                profile: profile,
                onRefresh: () {
                  refreshes++;
                  return request.future;
                },
                onLogout: () async {}))));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, 600));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(refreshes, 1);
    expect(find.text('Mi expediente'), findsOneWidget);
    request.complete();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('Welcome works on a small screen with enlarged text',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    var logins = 0;
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.dark),
        home: Scaffold(
            body: WelcomeScreen(onLogin: () => logins++, onActivate: () {}))));
    await tester.pumpAndSettle();
    final login = find.byKey(const ValueKey('welcome_login_button'));
    await tester.ensureVisible(login);
    await tester.tap(login);
    await tester.pumpAndSettle();
    expect(logins, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'AccountAccessScreen shows paste button and live 43-char code counter',
      (tester) async {
    final storage = InMemorySessionStorage();
    final service = AuthService(
      apiClient: ApiClient(
          sessionStorage: storage,
          httpHandler: (_) async => const ApiHttpResponse(statusCode: 200)),
      sessionStorage: storage,
    );
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.dark),
        home: AccountAccessScreen(
            mode: AccountAccessMode.activation, authService: service)));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Pegar código'), findsOneWidget);
    expect(find.text('0/43 caracteres'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('access-code')), 'a' * 43);
    await tester.pump();
    expect(find.text('43/43 caracteres'), findsOneWidget);
  });

  testWidgets('CheckInCard opens check-in when tapping the card body',
      (tester) async {
    String? openedDate;
    final ctx = CheckInContext({
      'clientId': 'client',
      'today': '2026-11-23',
      'localDate': '2026-11-23',
      'canWrite': true,
      'dates': [
        {'localDate': '2026-11-23', 'recorded': false}
      ],
      'checkIn': null,
      'nutrition': {'applicable': false},
      'training': null,
    });
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: Scaffold(
            body: CheckInCard(
                context_: ctx,
                loading: false,
                error: null,
                onOpen: (d) => openedDate = d,
                onRetry: () {}))));
    await tester.tap(find.text('Registra tu peso, sueño y cómo te sientes.'));
    expect(openedDate, '2026-11-23');
  });

  testWidgets('NutritionPlanView shows StatusView instead of bare spinner',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.dark),
        home: Scaffold(
            body:
                NutritionPlanView(plan: null, loading: true, onRetry: () {}))));
    expect(find.byType(StatusView), findsOneWidget);
    expect(find.text('Consultando tu plan…'), findsOneWidget);
  });

  for (final width in [320.0, 390.0, 768.0]) {
    testWidgets(
        'ProgressTab and FollowUpProgress fit $width px with enlarged text',
        (tester) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.8;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
        tester.platformDispatcher.clearTextScaleFactorTestValue();
      });
      final api = ApiClient(
          sessionStorage: InMemorySessionStorage(
              initialSession: StoredSession(
                  accessToken: 't',
                  refreshToken: 't',
                  expiresAt: DateTime.utc(2040))),
          httpHandler: (req) async {
            if (req.path.startsWith('/api/me/progress')) {
              return const ApiHttpResponse(statusCode: 200, body: {
                'visibility': {'measurements': false, 'adherence': false}
              });
            }
            return const ApiHttpResponse(statusCode: 200, body: {
              'checkIns': [
                {
                  'id': 'c1',
                  'localDate': '2026-11-23',
                  'revision': 1,
                  'bodyWeightKg': 70.2,
                  'sleepHours': 7.5,
                  'energy': 4,
                  'comment': 'Buenas sensaciones',
                }
              ],
              'nextOffset': null
            });
          });
      final history = TrainingHistory({
        'sessions': [
          {
            'id': 's1',
            'localDate': '2026-11-23',
            'status': 'finalized',
            'dayName': 'Tren superior',
            'exercises': [
              {
                'key': 'ex1',
                'name': 'Press banca',
                'loadMode': 'external',
                'muscles': ['Pecho'],
                'bodyPart': 'Pecho',
                'sets': [
                  {
                    'setId': 'set1',
                    'state': 'performed',
                    'reps': 8,
                    'loadKg': 60.0,
                    'rpe': 8.0,
                    'rir': null,
                  }
                ]
              }
            ]
          },
          {
            'id': 's0',
            'localDate': '2026-11-16',
            'status': 'finalized',
            'dayName': 'Tren superior',
            'exercises': [
              {
                'key': 'ex1',
                'name': 'Press banca',
                'loadMode': 'external',
                'muscles': ['Pecho'],
                'bodyPart': 'Pecho',
                'sets': [
                  {
                    'setId': 'set1',
                    'state': 'performed',
                    'reps': 8,
                    'loadKg': 57.5,
                    'rpe': 8.0,
                    'rir': null,
                  }
                ]
              }
            ]
          },
        ],
        'nextOffset': null
      });
      await tester.pumpWidget(MaterialApp(
          theme: mobileTheme(Brightness.light),
          home: Scaffold(
              body: ListView(children: [
            ProgressTab(
                history: history,
                failed: false,
                today: '2026-11-23',
                onRetry: () {},
                overviewFooter: FollowUpProgress(
                    service: CheckInService(apiClient: api),
                    clientId: 'client'))
          ]))));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Cuerpo'));
      await tester.pumpAndSettle();
      expect(find.text('70,2 kg'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  if (const bool.fromEnvironment('CAPTURE_MOBILE_PREVIEWS')) {
    setUpAll(() async {
      const fontDirectory = String.fromEnvironment('MOBILE_PREVIEW_FONTS');
      if (fontDirectory.isNotEmpty) {
        final textFont = FontLoader('Roboto')
          ..addFont(Future.value(ByteData.sublistView(
              await File('$fontDirectory/roboto-regular.ttf').readAsBytes())));
        final icons = FontLoader('MaterialIcons')
          ..addFont(Future.value(ByteData.sublistView(
              await File('$fontDirectory/materialicons-regular.otf')
                  .readAsBytes())));
        await textFont.load();
        await icons.load();
      }
    });
    for (final brightness in Brightness.values) {
      for (final screen in ['welcome', 'login', 'profile']) {
        testWidgets('Preview $brightness screen=$screen', (tester) async {
          tester.view.physicalSize = const Size(390, 844);
          tester.view.devicePixelRatio = 1;
          addTearDown(() {
            tester.view.resetPhysicalSize();
            tester.view.resetDevicePixelRatio();
          });
          final boundaryKey = GlobalKey();
          await tester.pumpWidget(RepaintBoundary(
              key: boundaryKey,
              child: MaterialApp(
                  debugShowCheckedModeBanner: false,
                  theme: mobileTheme(brightness),
                  home: Scaffold(
                      appBar: AppBar(
                          title: screen == 'profile'
                              ? const Text('CouchOne Fit')
                              : null),
                      body: SafeArea(
                          child: screen == 'welcome'
                              ? WelcomeScreen(onLogin: () {}, onActivate: () {})
                              : screen == 'login'
                                  ? LoginScreen(
                                      isSubmitting: false,
                                      onSubmit: (_, __) async {},
                                      onActivate: () {},
                                      onRecover: () {})
                                  : ClientProfileScreen(
                                      profile: profile,
                                      onRefresh: () async {},
                                      onLogout: () async {},
                                      onCredentials: () {}))))));
          await tester.pumpAndSettle();
          final boundary = boundaryKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
          await tester.runAsync(() async {
            final image = await boundary.toImage(pixelRatio: 2);
            final bytes =
                await image.toByteData(format: ui.ImageByteFormat.png);
            final path =
                '${const String.fromEnvironment('MOBILE_PREVIEW_DIR')}/$screen-${brightness.name}.png';
            await File(path).writeAsBytes(bytes!.buffer.asUint8List());
            image.dispose();
          });
        });
      }
    }
  }
}

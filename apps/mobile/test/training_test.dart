import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/training/models/training.dart';
import 'package:couchonefit_mobile/features/training/models/training_progress.dart';
import 'package:couchonefit_mobile/features/training/services/training_service.dart';
import 'package:couchonefit_mobile/features/training/screens/client_shell.dart';
import 'package:couchonefit_mobile/features/training/screens/progress_tab.dart';
import 'package:couchonefit_mobile/features/training/screens/session_summary_screen.dart';
import 'package:couchonefit_mobile/features/training/screens/training_session_screen.dart';
import 'package:couchonefit_mobile/features/training/screens/training_views.dart';
import 'package:couchonefit_mobile/features/training/widgets/muscle_map.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';
import 'package:couchonefit_mobile/shared/widgets/gradient_widgets.dart';
import 'package:couchonefit_mobile/features/settings/models/app_settings.dart';
import 'package:couchonefit_mobile/features/settings/services/settings_controller.dart';

Map<String, Object?> fixture() => {
      'clientId': 'client-a',
      'localDate': '2026-11-04',
      'today': '2026-11-04',
      'timeZone': 'America/Mexico_City',
      'canWrite': true,
      'activeRevision': 1,
      'dayId': 'day',
      'session': null,
      'plan': {
        'id': 'version',
        'clientId': 'client-a',
        'number': 1,
        'published': true,
        'name': 'Fuerza y equilibrio',
        'schedule': 'cycle',
        'startDate': '2026-11-04',
        'days': [
          {
            'id': 'day',
            'name': 'Tren inferior',
            'kind': 'training',
            'date': null,
            'exercises': [
              {
                'id': 'exercise',
                'name': 'Sentadilla corporal',
                'instructions': 'Controla el descenso.',
                'loadMode': 'bodyweight',
                'restSeconds': 60,
                'guidance': <String>[],
                'images': <String>[],
                'sets': [
                  {
                    'id': 'set',
                    'reps': 12,
                    'repsMax': 15,
                    'rpe': 7.5,
                    'rir': 2,
                    'targetLoadKg': null
                  }
                ]
              }
            ]
          },
          {
            'id': 'rest',
            'name': 'Recuperación',
            'kind': 'rest',
            'date': null,
            'exercises': <Object>[]
          }
        ]
      }
    };
final profile = ClientProfile.fromJson({
  'id': 'client-a',
  'userId': 'user-a',
  'fullName': 'Sofía Cliente',
  'status': 'active'
});
ApiClient api(JsonHttpHandler handler) => ApiClient(
    sessionStorage: InMemorySessionStorage(
        initialSession: StoredSession(
            accessToken: 'test',
            refreshToken: 'test',
            expiresAt: DateTime.utc(2040))),
    httpHandler: handler);
Widget host(Widget child, Brightness theme) =>
    MaterialApp(theme: mobileTheme(theme), home: child);
Map<String, Object?> session(String date, double load, int reps,
        {String status = 'finalized'}) =>
    {
      'id': 'session-$date',
      'localDate': date,
      'status': status,
      'dayName': 'Tren inferior',
      'exercises': [
        {
          'key': 'exercise',
          'name': 'Sentadilla corporal',
          'loadMode': 'external',
          'muscles': ['Cuádriceps', 'Glúteo mayor'],
          'bodyPart': 'Piernas',
          'sets': [
            {
              'setId': 'set',
              'state': 'performed',
              'reps': reps,
              'loadKg': load,
              'rpe': null,
              'rir': 2
            },
            null
          ]
        }
      ]
    };
Map<String, Object?> historyFixture() => {
      'sessions': [
        session('2026-11-02', 50, 10),
        session('2026-10-26', 45, 10),
        session('2026-10-19', 40, 12, status: 'draft'),
      ],
      'nextOffset': null
    };
Map<String, Object?> checkInFixture() => {
      'clientId': 'client-a',
      'today': '2026-11-04',
      'timeZone': 'America/Mexico_City',
      'canWrite': true,
      'localDate': '2026-11-04',
      'dates': [
        {'localDate': '2026-11-04', 'recorded': false},
        {'localDate': '2026-11-03', 'recorded': true},
        {'localDate': '2026-11-02', 'recorded': false},
      ],
      'checkIn': null,
      'nutrition': {'applicable': false, 'planName': null},
      'training': null,
    };
JsonHttpHandler routed(Map<String, Object?> Function() context) =>
    (request) async => ApiHttpResponse(
        statusCode: 200,
        body: request.path.startsWith('/api/me/training-history')
            ? historyFixture()
            : request.path.startsWith('/api/me/nutrition-plan')
                ? const {'plan': null}
                : request.path.startsWith('/api/me/check-ins/context')
                    ? checkInFixture()
                    : request.path.startsWith('/api/me/check-ins')
                        ? const {'checkIns': [], 'nextOffset': null}
                        : request.path.startsWith('/api/me/progress')
                            ? const {
                                'today': '2026-11-04',
                                'visibility': {
                                  'measurements': false,
                                  'adherence': false
                                }
                              }
                            : context());
void main() {
  test('published boundary, cache isolation, expiry and UUID keys', () async {
    final raw = fixture();
    final plan = raw['plan'] as Map<String, Object?>;
    plan['published'] = false;
    expect(() => TrainingContext(raw), throwsFormatException);
    var now = DateTime.utc(2026, 11, 4);
    final cache = TrainingCache(now: () => now);
    await cache.save(profile, TrainingContext(fixture()));
    expect((await cache.read(clientId: profile.id))?.context.plan?.name,
        'Fuerza y equilibrio');
    final exercise = TrainingContext(fixture()).day!.exercises.single;
    expect(exercise.sets.single.target, '12–15 reps · RPE 7,5 · RIR 2');
    expect(exercise.summary, '1 × 12–15 reps · RPE 7,5 · RIR 2');
    expect(exercise.restLabel, 'Descanso 1 min');
    final weekly = TrainingPlan({
      ...(fixture()['plan'] as Map<String, Object?>),
      'schedule': 'weekly',
      'startDate': '2026-11-02'
    });
    expect(weekly.dayFor('2026-11-03')?.id, 'rest');
    expect(weekly.dayFor('2026-11-01'), isNull);
    final ranged = fixture();
    (((((ranged['plan'] as Map)['days'] as List).first as Map)['exercises']
            as List)
        .first as Map)['sets'] = [
      {
        'id': 'set',
        'reps': 12,
        'repsMax': 10,
        'rpe': null,
        'targetLoadKg': null
      }
    ];
    expect(() => TrainingContext(ranged), throwsFormatException);
    expect(await cache.read(clientId: 'another'), isNull);
    await cache.save(profile, TrainingContext(fixture()));
    now = now.add(const Duration(days: 30));
    expect(await cache.read(), isNull);
    expect(
        trainingId(),
        matches(RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
  });
  test('set types: legacy default, badges, summary and unknown types', () {
    Map<String, Object?> set(String id, String? kind, int reps) => {
          'id': id,
          if (kind != null) 'kind': kind,
          'reps': reps,
          'repsMax': null,
          'rpe': null,
          'rir': kind == 'failure' ? 0 : null,
          'targetLoadKg': null
        };
    TrainingExercise exercise(List<Map<String, Object?>> sets) {
      final raw = fixture();
      final json = ((((raw['plan'] as Map)['days'] as List).first
              as Map)['exercises'] as List)
          .first as Map<String, Object?>;
      return TrainingExercise({...json, 'sets': sets});
    }

    final legacy = exercise([set('a', null, 8)]);
    expect(legacy.sets.single.kind, 'working');
    final mixed = exercise([
      set('w1', 'warmup', 12),
      set('w2', 'warmup', 8),
      set('t', 'top', 5),
      set('b', 'backoff', 8),
      set('n', 'working', 8),
      set('f', 'failure', 8),
    ]);
    expect([for (var i = 0; i < 6; i++) mixed.badgeFor(i)],
        ['C', 'C', 'T', 'B', '3', 'F']);
    expect(mixed.sets[2].target, 'Top set · 5 reps');
    expect(mixed.sets[5].target, 'Al fallo · 8 reps · RIR 0');
    expect(mixed.summary, '2 calent. + 4 series');
    expect(exercise([set('w', 'warmup', 10), set('x', null, 8)]).summary,
        '1 calent. + 1 × 8 reps');
    expect(() => exercise([set('s', 'superset', 8)]), throwsFormatException);
  });

  test('progress stats, streak, records and Spanish number formats', () {
    final history = TrainingHistory(historyFixture());
    final stats = TrainingStats(history, '2026-11-04');
    expect([stats.total, stats.thisMonth, stats.weekStreak], [3, 1, 3]);
    // A week without training breaks the streak once it is over.
    expect(TrainingStats(history, '2026-11-17').weekStreak, 0);
    expect(trainingThousands(stats.volume), '1.430');
    expect(trainingThousands(307450), '307.450');
    final progress = exerciseProgress(history).single;
    expect(progress.values, [40, 45, 50]);
    expect([progress.best, progress.change], [50, 10]);
    expect(lastTime(history, 'exercise', '2026-11-02')?.$1, '2026-10-26');
    expect(bestBefore(history, 'exercise', false, '2026-11-04'), 50);
    expect(setShort(history.sessions.first.exercises.single.sets.first!),
        '50×10 (RIR 2)');
  });
  test('muscle balance, estimated recovery and strength', () {
    final history = TrainingHistory(historyFixture());
    expect(muscleGroups(['Cuádriceps', 'Glúteo mayor', 'Desconocido'], null),
        ['Cuádriceps', 'Glúteos']);
    expect(muscleGroups(const [], 'Pecho'), ['Pecho']);
    expect(setsByGroup(history).map((e) => '${e.key}:${e.value}'),
        ['Cuádriceps:3', 'Glúteos:3']);
    expect(setsByGroup(history, since: '2026-11-02').first.value, 1);
    final r = recovery(history, '2026-11-03').first;
    expect([r.group, r.daysAgo, r.neededDays, r.status],
        ['Cuádriceps', 1, 2, 'Recuperándose']);
    expect(recovery(history, '2026-11-04').first.status, 'Recuperado');
    expect(exerciseProgress(history).single.estimates.map((v) => v.round()),
        [56, 60, 67]);
  });
  test('settings fall back to defaults and persist on the device', () async {
    expect(
        AppSettings.fromJson(
                {'themeMode': 'dark', 'defaultRestSeconds': 7, 'loadStep': 3})
            .toJson(),
        {
          'themeMode': 'dark',
          'restTimer': true,
          'defaultRestSeconds': 90,
          'loadStep': 2.5,
          'haptics': true,
          'workoutNotification': true,
          'mealReminders': true,
          'mealReminderLeadMinutes': 15,
        });
    final first = SettingsController();
    await first.update(first.value.copyWith(restTimer: false, loadStep: 5));
    final second = SettingsController();
    await second.load();
    expect([second.value.restTimer, second.value.loadStep], [false, 5.0]);
  });
  testWidgets('screen readers can activate custom navigation and week days',
      (tester) async {
    final handle = tester.ensureSemantics();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(host(
        ClientShell(
            profile: profile,
            service: TrainingService(apiClient: api(routed(fixture))),
            account: const Text('Expediente existente')),
        Brightness.dark));
    await tester.pumpAndSettle();
    for (final label in [
      RegExp(r'^Planes$'),
      RegExp(r'^Entrenar$'),
      RegExp(r'^martes 3 de noviembre'),
    ]) {
      expect(
          tester
              .getSemantics(find.bySemanticsLabel(label))
              .getSemanticsData()
              .hasAction(SemanticsAction.tap),
          isTrue,
          reason: '$label');
    }
    tester.semantics.tap(find.semantics.byLabel(RegExp(r'^Planes$')));
    await tester.pumpAndSettle();
    expect(find.text('Fuerza y equilibrio'), findsOneWidget);
    handle.dispose();
  });
  // Phone, then an 11" tablet in portrait and landscape.
  for (final size in [
    const Size(390, 844),
    const Size(800, 1280),
    const Size(1280, 800)
  ]) {
    testWidgets('bottom bar always; two columns only with room at $size',
        (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(host(
          ClientShell(
              profile: profile,
              service: TrainingService(apiClient: api(routed(fixture))),
              account: const Text('Expediente existente')),
          Brightness.light));
      await tester.pumpAndSettle();
      final wide = size.width >= 1000;
      // Left column holds the workout; the right one starts at the top.
      void sideBySide(String left, String right) {
        final a = tester.getRect(find.text(left)),
            b = tester.getRect(find.text(right));
        expect(b.left > a.right && b.top < a.top, wide,
            reason: '$left | $right');
      }

      sideBySide('Empezar entrenamiento', 'Check-in de hoy');
      expect(find.byType(NavigationRail), findsNothing);
      final inicio = tester.getRect(find.text('Inicio'));
      expect(inicio.bottom, greaterThan(size.height - 40));
      // The bar keeps phone spacing: centered and at most 560 wide.
      expect(inicio.left, greaterThanOrEqualTo((size.width - 560) / 2));
      expect(tester.getCenter(find.text('Entrenar')).dx, size.width / 2);
      await tester.tap(find.text('Progreso'));
      await tester.pumpAndSettle();
      sideBySide('Actividad · últimos 4 meses', 'Balance');
      expect(tester.takeException(), isNull);
    });
  }
  for (final width in [320.0, 390.0, 768.0]) {
    for (final theme in Brightness.values) {
      testWidgets('navigation and plans at $width $theme enlarged text',
          (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = 1.8;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          tester.platformDispatcher.clearTextScaleFactorTestValue();
        });
        final service = TrainingService(apiClient: api(routed(fixture)));
        await tester.pumpWidget(host(
            ClientShell(
                profile: profile,
                service: service,
                account: const Text('Expediente existente')),
            theme));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Hola, Sofía'), findsOneWidget);
        // Tablets keep the phone's bottom bar, never a side rail.
        expect(find.byType(NavigationRail), findsNothing);
        expect(find.text('Entrenar'), findsOneWidget);
        expect(find.text('Empezar entrenamiento'), findsOneWidget);
        expect(find.text('Recuperación muscular'), findsOneWidget);
        expect(find.text('Check-in de hoy'), findsOneWidget);
        expect(find.text('Anteayer'), findsOneWidget);
        await tester.tap(find.text('Planes'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Recuperación'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Recuperación'));
        await tester.pumpAndSettle();
        expect(
            find.textContaining('Día de descanso programado'), findsOneWidget);
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Alimentación'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Alimentación'));
        await tester.pumpAndSettle();
        expect(find.text('Todavía no tienes un plan alimenticio asignado'),
            findsOneWidget);
        await tester.tap(find.text('Progreso'));
        await tester.pumpAndSettle();
        final error = tester.takeException();
        expect(error, isNull,
            reason: error is FlutterError ? error.toStringDeep() : '$error');
        expect(find.text('Levantado en total'), findsOneWidget);
        await tester.ensureVisible(find.text('Recuperación'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Recuperación'));
        await tester.pumpAndSettle();
        expect(find.textContaining('Recuperado ·'), findsWidgets);
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Sentadilla corporal'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Sentadilla corporal'));
        await tester.pumpAndSettle();
        expect(find.text('Mejor marca'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tester.tap(find.text('Cuenta'));
        await tester.pumpAndSettle();
        expect(find.text('Expediente existente'), findsOneWidget);
      });
    }
  }
  testWidgets(
      'explicit results, incomplete finalization and response loss retry with same key',
      (tester) async {
    final requests = <ApiHttpRequest>[];
    final service = TrainingService(apiClient: api((request) async {
      requests.add(request);
      if (requests.length == 1) {
        return const ApiHttpResponse(statusCode: 503, body: {
          'error': {'code': 'SERVICE_UNAVAILABLE', 'message': 'Sin conexión'}
        });
      }
      return ApiHttpResponse(statusCode: 200, body: {
        'session': {
          'id': request.body!['id'],
          'revision': 1,
          'status': 'finalized',
          'results': request.body!['results']
        }
      });
    }));
    await tester.pumpWidget(host(
        TrainingSessionScreen(
            contextData: TrainingContext(fixture()), service: service),
        Brightness.light));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(requests, isEmpty);
    expect(find.textContaining('12–15 reps · RPE 7,5 · RIR 2'), findsWidgets);
    expect(find.byType(TextField), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('reps-set')), '9');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    await tester
        .ensureVisible(find.byKey(const ValueKey('effort-mode-exercise')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('effort-mode-exercise')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('effort-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('effort-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '8,5'));
    await tester.pumpAndSettle();
    await tester
        .ensureVisible(find.byKey(const ValueKey('effort-mode-exercise')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('effort-mode-exercise')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('effort-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('effort-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '1'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    expect(find.text('1/1'), findsOneWidget);
    await tester.ensureVisible(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(requests.length, 1);
    expect((requests.first.body!['results'] as List).first, {
      'setId': 'set',
      'state': 'performed',
      'reps': 9,
      'loadKg': 0,
      'rpe': 8.5,
      'rir': 1
    });
    await tester.ensureVisible(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(requests.length, 2);
    expect(requests[0].headers['Idempotency-Key'],
        requests[1].headers['Idempotency-Key']);
    expect(jsonEncode(requests[0].body), jsonEncode(requests[1].body));
    expect(find.text('¡Entrenamiento completado!'), findsOneWidget);
    expect(find.text('Mejor serie: 9 reps'), findsOneWidget);
  });
  testWidgets('set logger fits 320 px with enlarged text and external load',
      (tester) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    final raw = fixture();
    final exercise = ((((raw['plan'] as Map)['days'] as List).first
            as Map)['exercises'] as List)
        .first as Map;
    exercise['loadMode'] = 'external';
    (exercise['sets'] as List).first['targetLoadKg'] = 40;
    await tester.pumpWidget(host(
        TrainingSessionScreen(
            contextData: TrainingContext(raw),
            service: TrainingService(
                apiClient: api((_) async =>
                    const ApiHttpResponse(statusCode: 200, body: {})))),
        Brightness.dark));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.byKey(const ValueKey('effort-set')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    // Empty fields adopt the prescribed load and the minimum reps.
    expect(find.text('1/1'), findsOneWidget);
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('kg-set')))
            .controller!
            .text,
        '40');
    expect(tester.takeException(), isNull);
  });
  testWidgets('minimizing keeps the live workout until it is discarded',
      (tester) async {
    await tester.pumpWidget(host(
        ClientShell(
            profile: profile,
            service: TrainingService(apiClient: api(routed(fixture))),
            account: const Text('Cuenta')),
        Brightness.light));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Empezar entrenamiento'));
    await tester.pumpAndSettle();
    final live = tester.state(find.byType(TrainingSessionScreen));
    await tester.tap(find.byTooltip('Minimizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(find.text('Entrenamiento en curso'), findsOneWidget);
    await tester.tap(find.text('Entrenamiento en curso'));
    await tester.pumpAndSettle();
    // Same State: captures, timers and duration survived.
    expect(tester.state(find.byType(TrainingSessionScreen)), same(live));
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Entrenamiento en curso'), findsOneWidget);
    await tester.tap(find.byTooltip('Descartar entrenamiento'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Descartar'));
    await tester.pumpAndSettle();
    expect(find.byType(TrainingSessionScreen), findsNothing);
    expect(find.text('Entrenamiento en curso'), findsNothing);
  });
  testWidgets('offline read is explicit and never enables execution',
      (tester) async {
    final cache = TrainingCache();
    await cache.save(profile, TrainingContext(fixture()));
    final service = TrainingService(
        cache: cache,
        apiClient:
            api((_) async => const ApiHttpResponse(statusCode: 503, body: {
                  'error': {
                    'code': 'SERVICE_UNAVAILABLE',
                    'message': 'Sin conexión'
                  }
                })));
    await tester.pumpWidget(host(
        ClientShell(
            profile: profile, service: service, account: const Text('Cuenta')),
        Brightness.dark));
    await tester.pumpAndSettle();
    expect(find.textContaining('Lectura guardada'), findsOneWidget);
    expect(
        tester
            .widget<GradientActionButton>(find.byType(GradientActionButton))
            .onPressed,
        isNull);
  });
  testWidgets('last time drives hints, comparison and skipped sets',
      (tester) async {
    final raw = fixture();
    final exercise = ((((raw['plan'] as Map)['days'] as List).first
            as Map)['exercises'] as List)
        .first as Map;
    exercise['loadMode'] = 'external';
    exercise['muscles'] = ['Cuádriceps'];
    final sets = exercise['sets'] as List;
    sets.add(<String, Object?>{...(sets.first as Map), 'id': 'set-2'});
    Map<String, Object?>? sent;
    final service = TrainingService(apiClient: api((request) async {
      sent = request.body;
      return ApiHttpResponse(statusCode: 200, body: {
        'session': {
          'id': request.body!['id'],
          'revision': 1,
          'status': 'finalized',
          'results': request.body!['results']
        }
      });
    }));
    await tester.pumpWidget(host(
        TrainingSessionScreen(
            contextData: TrainingContext(raw),
            service: service,
            history: TrainingHistory(historyFixture())),
        Brightness.light));
    await tester.pumpAndSettle();
    expect(find.text('Última vez: 2 nov'), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const ValueKey('previous-set'))).data,
        '50×10');
    expect(find.text('Mejor: 50 kg'), findsOneWidget);
    // 50 × 10 is under the 15-rep top, so the load stays.
    expect(find.text('Mantén 50 kg'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    // Hints repeat last time's set (50 kg × 10), so it starts even.
    expect(find.textContaining('= última vez'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('kg-set')), '52,5');
    await tester.pumpAndSettle();
    expect(find.textContaining('+2,5 kg'), findsOneWidget);
    // "No la hice" lives in the set number menu, Hevy-style.
    await tester.ensureVisible(find.byKey(const ValueKey('set-menu-set-2')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('set-menu-set-2')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('skip-set-2')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finalizar'));
    await tester.pumpAndSettle();
    expect(sent!['results'], [
      {
        'setId': 'set',
        'state': 'performed',
        'reps': 10,
        'loadKg': 52.5,
        'rpe': null,
        'rir': null
      },
      {
        'setId': 'set-2',
        'state': 'not_performed',
        'reps': 0,
        'loadKg': null,
        'rpe': null,
        'rir': null
      },
    ]);
    expect(find.textContaining('¡Récord personal!'), findsOneWidget);
    expect(find.text('Próxima vez: mantén 52,5 kg'), findsOneWidget);
    expect(find.text('Cuádriceps · 1 serie'), findsOneWidget);
  });
  testWidgets('rest timer, steppers and the disabled setting', (tester) async {
    var now = DateTime(2026, 11, 4, 18);
    final raw = fixture();
    final exercise = ((((raw['plan'] as Map)['days'] as List).first
            as Map)['exercises'] as List)
        .first as Map;
    exercise['loadMode'] = 'external';
    final sets = exercise['sets'] as List;
    sets.first['targetLoadKg'] = 40;
    sets.add(<String, Object?>{...(sets.first as Map), 'id': 'set-2'});
    Future<void> open(AppSettings settings) => tester.pumpWidget(host(
        TrainingSessionScreen(
            key: UniqueKey(),
            contextData: TrainingContext(raw),
            settings: settings,
            clock: () => now,
            service: TrainingService(
                apiClient: api((_) async =>
                    const ApiHttpResponse(statusCode: 200, body: {})))),
        Brightness.dark));
    await open(const AppSettings());
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byTooltip('Sumar a kg de la serie 1'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Sumar a kg de la serie 1'));
    await tester.pumpAndSettle();
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('kg-set')))
            .controller!
            .text,
        '42,5');
    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    Text left() => tester.widget<Text>(find.byKey(const ValueKey('rest-left')));
    expect(left().data, '1:00');
    await tester.tap(find.text('+15 s'));
    await tester.pump();
    expect(left().data, '1:15');
    now = now.add(const Duration(seconds: 20));
    await tester.pump(const Duration(seconds: 1));
    expect(left().data, '0:55');
    await tester.tap(find.byTooltip('Pausar descanso'));
    await tester.pump();
    now = now.add(const Duration(seconds: 30));
    await tester.pump(const Duration(seconds: 1));
    expect(left().data, '0:55');
    expect(find.text('Descanso en pausa'), findsOneWidget);
    await tester.tap(find.byTooltip('Reanudar descanso'));
    await tester.pump();
    now = now.add(const Duration(seconds: 56));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byKey(const ValueKey('rest-left')), findsNothing);
    expect(find.textContaining('Descanso terminado'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
    await open(const AppSettings(restTimer: false));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rest-left')), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('recovery figure reports the overall and per-group estimate',
      (tester) async {
    // Pecho: 1 of 3 days (33 %); Cuádriceps: 4 of 2 days (100 %).
    final items = [
      GroupRecovery('Pecho', '2026-11-03', 8, 1),
      GroupRecovery('Cuádriceps', '2026-10-31', 6, 4),
    ];
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(host(
        Scaffold(
            body: SingleChildScrollView(child: RecoveryBody(items: items))),
        Brightness.dark));
    expect(find.textContaining('67 %'), findsOneWidget);
    expect(
        find.bySemanticsLabel(RegExp(
            r'Recuperación de lo entrenado 67 %\. Pecho 33 %, Cuádriceps 100 %')),
        findsOneWidget);
    expect(recoveryColor(.33), BrandColors.highlight);
    expect(recoveryColor(1), BrandColors.success);
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });
  testWidgets('missing illustrations have an explicit fallback',
      (tester) async {
    await tester.pumpWidget(host(
        const Scaffold(
            body: ExerciseAnimation(
                images: ['https://example.invalid/image.webp'],
                label: 'Sentadilla')),
        Brightness.light));
    await tester.pumpAndSettle();
    expect(find.text('Ilustración no disponible'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('GIF plays over the still unless paused or reduced motion',
      (tester) async {
    Future<int> frames({bool paused = false, bool still = false}) async {
      await tester.pumpWidget(host(
          Builder(
              builder: (context) => MediaQuery(
                  data:
                      MediaQuery.of(context).copyWith(disableAnimations: still),
                  child: Scaffold(
                      body: ExerciseAnimation(images: const [
                    'https://example.invalid/0001.jpg',
                    'https://example.invalid/0001.gif'
                  ], label: 'Sentadilla', paused: paused)))),
          Brightness.light));
      await tester.pumpAndSettle();
      return find.byType(Image).evaluate().length;
    }

    expect(await frames(), 2);
    expect(await frames(paused: true), 1);
    expect(await frames(still: true), 1);
  });
  test('double progression advice and one-rep max', () {
    PrescribedSet set(String id, int reps,
            {int? max, String kind = 'working', double? load}) =>
        PrescribedSet({
          'id': id,
          'kind': kind,
          'reps': reps,
          'repsMax': max,
          'rpe': null,
          'rir': null,
          'targetLoadKg': load
        });
    SetResult done(double kg, int reps) => SetResult({
          'setId': 's',
          'state': 'performed',
          'reps': reps,
          'loadKg': kg,
          'rpe': null,
          'rir': null
        });
    final plan = [
      set('w', 10, kind: 'warmup'),
      set('a', 10),
      set('b', 10),
      set('c', 10)
    ];
    // The coach set 3 × 10 and every working set reached 10+ reps at 50 kg.
    final up = loadAdvice(
        plan, [done(20, 10), done(50, 11), done(50, 10), done(50, 10)], 2.5)!;
    expect([
      up.kind,
      up.fromKg,
      up.toKg,
      up.lastReps,
      up.topReps
    ], [
      LoadAdviceKind.increase,
      50,
      52.5,
      [11, 10, 10],
      10
    ]);
    // One short set keeps the load; the warm-up never counts.
    final keep =
        loadAdvice(plan, [null, done(50, 10), done(50, 10), done(50, 8)], 2.5)!;
    expect([keep.kind, keep.toKg], [LoadAdviceKind.keep, 50]);
    // Reaching the reps with a lighter load is not reaching the load.
    expect(
        loadAdvice(plan, [null, done(50, 10), done(50, 10), done(45, 12)], 2.5)!
            .kind,
        LoadAdviceKind.keep);
    // Ranges count from their top; a missing set keeps the load.
    final ranged = [set('a', 8, max: 12), set('b', 8, max: 12)];
    expect(loadAdvice(ranged, [done(60, 12), done(60, 10)], 2.5)!.kind,
        LoadAdviceKind.keep);
    expect(loadAdvice(ranged, [done(60, 12), null], 2.5)!.kind,
        LoadAdviceKind.keep);
    expect(loadAdvice(ranged, [done(60, 12), done(60, 13)], 5)!.toKg, 65);
    // The professional's working load always wins; nothing to build on: null.
    expect(loadAdvice([set('a', 10, load: 40)], [done(40, 12)], 2.5), isNull);
    expect(loadAdvice(plan, const [], 2.5), isNull);
    expect([
      oneRepMax(100, 1),
      oneRepMax(100, 10).toStringAsFixed(1),
      repsAtFraction(1),
      repsAtFraction(.75),
      roundToStep(66.67, .5)
    ], [
      100,
      '133.3',
      1,
      10,
      66.5
    ]);
  });
  testWidgets('load advice, quick load picker and 1RM calculator',
      (tester) async {
    final raw = fixture();
    final exercise = ((((raw['plan'] as Map)['days'] as List).first
            as Map)['exercises'] as List)
        .first as Map;
    exercise['loadMode'] = 'external';
    final sets = exercise['sets'] as List;
    sets.add(<String, Object?>{...(sets.first as Map), 'id': 'set-2'});
    // Last time both sets reached the top of 12–15 reps at 50 kg.
    final past = session('2026-11-02', 50, 15);
    final pastSets = ((past['exercises'] as List).first as Map)['sets'] as List;
    pastSets[1] = <String, Object?>{
      ...(pastSets.first as Map),
      'setId': 'set-2'
    };
    await tester.pumpWidget(host(
        TrainingSessionScreen(
            contextData: TrainingContext(raw),
            service: TrainingService(
                apiClient: api((request) async =>
                    const ApiHttpResponse(statusCode: 200, body: {}))),
            history: TrainingHistory({
              'sessions': [past],
              'nextOffset': null
            })),
        Brightness.dark));
    await tester.pumpAndSettle();
    String kg(String id) => tester
        .widget<EditableText>(find.descendant(
            of: find.byKey(ValueKey('kg-$id')),
            matching: find.byType(EditableText)))
        .controller
        .text;
    Future<void> tap(Finder finder) async {
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    expect(find.text('Sube a 52,5 kg'), findsOneWidget);
    expect(find.textContaining('50 kg × 15 · 15'), findsOneWidget);
    await tap(find.byKey(const ValueKey('use-load-exercise')));
    expect([kg('set'), kg('set-2')], ['52,5', '52,5']);

    await tap(find.byKey(const ValueKey('pick-load-exercise')));
    String value() => tester
        .widget<Text>(find.byKey(const ValueKey('load-picker-value')))
        .textSpan!
        .toPlainText();
    // Starts from what is already typed.
    expect(value(), '52,5 kg');
    await tap(find.byTooltip('Sumar 2,5 kg'));
    await tap(find.text('−0,5'));
    expect(value(), '54,5 kg');
    expect(find.textContaining('% de tu 1RM estimado (75 kg)'), findsOneWidget);
    await tap(find.byKey(const ValueKey('load-picker-apply')));
    expect([kg('set'), kg('set-2')], ['54,5', '54,5']);

    await tap(find.byKey(const ValueKey('pick-load-exercise')));
    await tap(find.text('Calculadora 1RM'));
    String orm() =>
        tester.widget<Text>(find.byKey(const ValueKey('orm-result'))).data!;
    // Prefilled with the chosen load and the top of the range.
    expect(orm(), '82 kg');
    expect(find.textContaining('pierde precisión'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('orm-kg')), '100');
    await tester.enterText(find.byKey(const ValueKey('orm-reps')), '5');
    await tester.pumpAndSettle();
    expect(orm(), '116,5 kg');
    expect(find.text('≈ 10 reps'), findsOneWidget);
    expect(find.textContaining('pierde precisión'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'bodyweight target omits 0 kg, ExerciseDetail toggles GIF pause and ProgressTab separates Cuerpo',
      (tester) async {
    final bwZero = PrescribedSet({
      'id': 's-bw',
      'kind': 'working',
      'reps': 10,
      'repsMax': 12,
      'rpe': null,
      'rir': 2,
      'targetLoadKg': 0
    });
    expect(bwZero.targetFor(bodyweight: true), '10–12 reps · RIR 2');
    expect(bwZero.targetFor(bodyweight: false), '10–12 reps · RIR 2 · 0 kg');

    final exercise = TrainingExercise({
      'id': 'ex-1',
      'catalogId': 'cat-1',
      'name': 'Puente de glúteos',
      'instructions': '',
      'loadMode': 'bodyweight',
      'restSeconds': 60,
      'guidance': ['Eleva la cadera.'],
      'images': [
        'https://example.invalid/still.jpg',
        'https://example.invalid/anim.gif',
      ],
      'muscles': ['Glúteo mayor'],
      'equipment': <String>[],
      'bodyPart': 'Glúteos',
      'sets': [
        {
          'id': 's-bw',
          'kind': 'working',
          'reps': 10,
          'repsMax': 12,
          'rpe': null,
          'rir': 2,
          'targetLoadKg': 0
        }
      ]
    });
    await tester.pumpWidget(
        host(ExerciseDetailScreen(exercise: exercise), Brightness.light));
    await tester.pumpAndSettle();
    expect(find.text('10–12 reps · RIR 2'), findsOneWidget);
    expect(find.text('Pausar'), findsOneWidget);
    await tester.tap(find.text('Pausar'));
    await tester.pumpAndSettle();
    expect(find.text('Reanudar'), findsOneWidget);

    await tester.pumpWidget(host(
        Scaffold(
            body: SingleChildScrollView(
                child: ProgressTab(
          history: TrainingHistory(historyFixture()),
          failed: false,
          today: '2026-11-04',
          onRetry: () {},
          overviewFooter: const Text('Bloque corporal de seguimiento'),
        ))),
        Brightness.light));
    await tester.pumpAndSettle();
    expect(find.text('Cuerpo'), findsOneWidget);
    expect(find.text('Bloque corporal de seguimiento'), findsNothing);
    await tester.tap(find.text('Cuerpo'));
    await tester.pumpAndSettle();
    expect(find.text('Bloque corporal de seguimiento'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'finishing inside ClientShell closes the session, freezes summary duration and refreshes home',
      (tester) async {
    Map<String, Object?>? savedSession;
    final handler = routed(() => {...fixture(), 'session': savedSession});
    final service = TrainingService(
      apiClient: api((request) async {
        if (request.method == 'POST' &&
            request.path == '/api/me/training-sessions') {
          savedSession = {
            'id': request.body!['id'],
            'revision': 1,
            'status': 'finalized',
            'results': request.body!['results'],
          };
          return ApiHttpResponse(
              statusCode: 200, body: {'session': savedSession});
        }
        if (request.path.startsWith('/api/me/training-history')) {
          final base = historyFixture();
          final sessions = List<Object?>.from(base['sessions'] as List);
          if (savedSession != null) {
            sessions.insert(0, session('2026-11-04', 0, 12));
          }
          return ApiHttpResponse(
            statusCode: 200,
            body: {'sessions': sessions, 'nextOffset': null},
          );
        }
        return handler(request);
      }),
    );

    await tester.pumpWidget(host(
        ClientShell(
            profile: profile, service: service, account: const Text('Cuenta')),
        Brightness.light));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Empezar entrenamiento'));
    await tester.pumpAndSettle();
    expect(find.byType(TrainingSessionScreen), findsOneWidget);

    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();

    expect(find.byType(SessionSummaryScreen), findsOneWidget);
    expect(find.text('¡Entrenamiento completado!'), findsOneWidget);
    expect(find.byType(TrainingSessionScreen), findsNothing);
    expect(find.text('Entrenamiento en curso'), findsNothing);

    await tester.pump(const Duration(seconds: 5));
    expect(tester.takeException(), isNull);
    expect(find.text('0:00'), findsOneWidget);

    await tester.ensureVisible(find.text('Listo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Listo'));
    await tester.pumpAndSettle();

    expect(find.byType(SessionSummaryScreen), findsNothing);
    expect(find.byType(TrainingSessionScreen), findsNothing);
    expect(find.text('Entrenamiento en curso'), findsNothing);
    expect(find.text('Registrado'), findsOneWidget);
    expect(find.text('Ver o corregir registro'), findsOneWidget);
  });

  testWidgets(
      'reopening a finalized session in ClientShell does not tick duration and closes cleanly on correction or back',
      (tester) async {
    var savedSession = <String, Object?>{
      'id': 'session-today',
      'revision': 1,
      'status': 'finalized',
      'results': [
        {
          'setId': 'set',
          'state': 'performed',
          'reps': 12,
          'loadKg': 0.0,
          'rpe': null,
          'rir': null,
        }
      ],
    };
    final handler = routed(() => {...fixture(), 'session': savedSession});
    final service = TrainingService(
      apiClient: api((request) async {
        if (request.method == 'POST' &&
            request.path == '/api/me/training-sessions') {
          savedSession = {
            'id': request.body!['id'],
            'revision': (savedSession['revision'] as int) + 1,
            'status': 'finalized',
            'results': request.body!['results'],
          };
          return ApiHttpResponse(
              statusCode: 200, body: {'session': savedSession});
        }
        if (request.path.startsWith('/api/me/training-history')) {
          final base = historyFixture();
          final sessions = List<Object?>.from(base['sessions'] as List)
            ..insert(0, session('2026-11-04', 0, 12));
          return ApiHttpResponse(
            statusCode: 200,
            body: {'sessions': sessions, 'nextOffset': null},
          );
        }
        return handler(request);
      }),
    );

    await tester.pumpWidget(host(
        ClientShell(
            profile: profile, service: service, account: const Text('Cuenta')),
        Brightness.dark));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ver o corregir registro'));
    await tester.pumpAndSettle();

    expect(find.byType(TrainingSessionScreen), findsOneWidget);
    expect(find.text('Duración'), findsNothing);
    expect(find.text('Estado'), findsOneWidget);
    expect(find.text('Finalizado'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(TrainingSessionScreen), findsNothing);
    expect(find.text('Entrenamiento en curso'), findsNothing);

    await tester.tap(find.text('Ver o corregir registro'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Cerrar registro'));
    await tester.pumpAndSettle();
    expect(find.byType(TrainingSessionScreen), findsNothing);
    expect(find.text('Entrenamiento en curso'), findsNothing);

    await tester.tap(find.text('Ver o corregir registro'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('reps-set')), '14');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Corregir'));
    await tester.pumpAndSettle();

    expect(find.byType(TrainingSessionScreen), findsNothing);
    expect(find.text('Entrenamiento en curso'), findsNothing);
    expect(find.text('Corrección guardada.'), findsOneWidget);
  });

  testWidgets(
      'finalizing with pending sets or server error scrolls to top and shows SnackBar feedback',
      (tester) async {
    tester.view.physicalSize = const Size(390, 500);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    var attempts = 0;
    final service = TrainingService(
      apiClient: api((request) async {
        attempts++;
        if (attempts == 1) {
          return const ApiHttpResponse(statusCode: 503, body: {
            'error': {'code': 'SERVICE_UNAVAILABLE', 'message': 'Sin conexión'}
          });
        }
        return ApiHttpResponse(statusCode: 200, body: {
          'session': {
            'id': request.body!['id'],
            'revision': 1,
            'status': 'finalized',
            'results': request.body!['results'],
          }
        });
      }),
    );

    await tester.pumpWidget(host(
        TrainingSessionScreen(
          contextData: TrainingContext(fixture()),
          service: service,
        ),
        Brightness.light));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text(
          'Marca cada serie como hecha o «No la hice» antes de finalizar.',
        ),
      ),
      findsOneWidget,
    );
    expect(find.byType(TrainingSessionScreen), findsOneWidget);

    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text('Sin conexión'),
      ),
      findsOneWidget,
    );
    expect(find.byType(TrainingSessionScreen), findsOneWidget);

    await tester.tap(find.text('Finalizar entrenamiento'));
    await tester.pumpAndSettle();
    expect(find.text('¡Entrenamiento completado!'), findsOneWidget);
  });

  testWidgets('completing the last set cancels any active rest timer',
      (tester) async {
    final raw = fixture();
    final exercise = ((((raw['plan'] as Map)['days'] as List).first
            as Map)['exercises'] as List)
        .first as Map;
    exercise['loadMode'] = 'external';
    final sets = exercise['sets'] as List;
    (sets.first as Map)['targetLoadKg'] = 40;
    sets.add(<String, Object?>{...(sets.first as Map), 'id': 'set-2'});

    await tester.pumpWidget(host(
        TrainingSessionScreen(
          contextData: TrainingContext(raw),
          settings: const AppSettings(),
          service: TrainingService(
            apiClient: api((_) async => const ApiHttpResponse(statusCode: 200)),
          ),
        ),
        Brightness.dark));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rest-left')), findsOneWidget);

    await tester.ensureVisible(find.byKey(const ValueKey('check-set-2')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('check-set-2')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rest-left')), findsNothing);
    expect(find.text('Finalizar entrenamiento'), findsOneWidget);
  });
}

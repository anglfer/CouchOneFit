import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/training/models/training.dart';
import 'package:couchonefit_mobile/features/training/models/training_progress.dart';
import 'package:couchonefit_mobile/features/training/services/training_service.dart';
import 'package:couchonefit_mobile/features/training/screens/client_shell.dart';
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
JsonHttpHandler routed(Map<String, Object?> Function() context) =>
    (request) async => ApiHttpResponse(
        statusCode: 200,
        body: request.path.startsWith('/api/me/training-history')
            ? historyFixture()
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
          'haptics': true
        });
    final first = SettingsController();
    await first.update(first.value.copyWith(restTimer: false, loadStep: 5));
    final second = SettingsController();
    await second.load();
    expect([second.value.restTimer, second.value.loadStep], [false, 5.0]);
  });
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
        expect(
            find.byType(NavigationRail), findsNWidgets(width >= 768 ? 1 : 0));
        if (width < 768) expect(find.text('Entrenar'), findsOneWidget);
        expect(find.text('Empezar entrenamiento'), findsOneWidget);
        expect(find.text('Recuperación muscular'), findsOneWidget);
        expect(find.text('Check-in diario y peso'), findsOneWidget);
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
        expect(find.text('Plan de alimentación'), findsOneWidget);
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
            r'Recuperación general 67 %\. Pecho 33 %, Cuádriceps 100 %')),
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
}

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/training/models/training.dart';
import 'package:couchonefit_mobile/features/training/services/training_service.dart';
import 'package:couchonefit_mobile/features/training/screens/client_shell.dart';
import 'package:couchonefit_mobile/features/training/screens/training_session_screen.dart';
import 'package:couchonefit_mobile/features/training/screens/training_views.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';

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
        final service = TrainingService(
            apiClient: api((_) async =>
                ApiHttpResponse(statusCode: 200, body: fixture())));
        await tester.pumpWidget(host(
            ClientShell(
                profile: profile,
                service: service,
                account: const Text('Expediente existente'),
                onThemeChanged: (_) {}),
            theme));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Hola, Sofía'), findsOneWidget);
        expect(find.byType(width >= 768 ? NavigationRail : NavigationBar),
            findsOneWidget);
        await tester.tap(find.text('Rutina'));
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
    await tester.ensureVisible(find.text('Hecha'));
    await tester.pumpAndSettle();
    expect(find.textContaining('12–15 reps · RPE 7,5 · RIR 2'), findsWidgets);
    await tester.tap(find.text('Hecha'));
    await tester.pumpAndSettle();
    expect(find.byType(TextFormField), findsOneWidget);
    expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField))
            .controller!
            .text,
        isEmpty);
    await tester.enterText(find.byType(TextFormField), '9');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('rpe-set')));
    await tester.tap(find.byKey(const ValueKey('rpe-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('8,5').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('rir-set')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('1').last);
    await tester.pumpAndSettle();
    expect(find.text('1 de 1 serie registrada'), findsOneWidget);
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
    expect(find.text('Guardar corrección'), findsOneWidget);
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
    await tester.ensureVisible(find.text('Hecha'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hecha'));
    await tester.pumpAndSettle();
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.byKey(const ValueKey('rir-set')), findsOneWidget);
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
            profile: profile,
            service: service,
            account: const Text('Cuenta'),
            onThemeChanged: (_) {}),
        Brightness.dark));
    await tester.pumpAndSettle();
    expect(find.textContaining('Lectura guardada'), findsOneWidget);
    expect(
        tester
            .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'Registrar entrenamiento'))
            .onPressed,
        isNull);
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

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/check_in/models/check_in.dart';
import 'package:couchonefit_mobile/features/check_in/screens/check_in_screen.dart';
import 'package:couchonefit_mobile/features/check_in/services/check_in_service.dart';
import 'package:couchonefit_mobile/features/check_in/widgets/follow_up_progress.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/nutrition/services/nutrition_service.dart';
import 'package:couchonefit_mobile/features/training/screens/client_shell.dart';
import 'package:couchonefit_mobile/features/training/services/training_service.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';

Map<String, Object?> contextFixture(
        {Map<String, Object?>? checkIn, bool nutrition = false}) =>
    {
      'clientId': 'client-a',
      'today': '2026-11-04',
      'timeZone': 'America/Mexico_City',
      'canWrite': true,
      'localDate': '2026-11-04',
      'dates': [
        {'localDate': '2026-11-04', 'recorded': checkIn != null},
        {'localDate': '2026-11-03', 'recorded': true},
        {'localDate': '2026-11-02', 'recorded': false},
      ],
      'checkIn': checkIn,
      'nutrition': {
        'applicable': nutrition,
        'planName': nutrition ? 'Plan QA' : null
      },
      'training': {
        'kind': 'training',
        'dayName': 'Tren inferior',
        'sessionStatus': 'finalized'
      },
    };
Map<String, Object?> saved(Map<String, Object?> body) => {
      'checkIn': {
        ...body,
        'revision': (body['revision'] as int) + 1,
        'timeZone': 'America/Mexico_City'
      }
    };

CheckInService service(JsonHttpHandler handler) => CheckInService(
    apiClient: ApiClient(
        sessionStorage: InMemorySessionStorage(
            initialSession: StoredSession(
                accessToken: 't',
                refreshToken: 't',
                expiresAt: DateTime.utc(2040))),
        httpHandler: handler));

/// Pushes the screen like Inicio does and records what it pops.
Future<List<CheckIn?>> open(
    WidgetTester tester, CheckInService s, CheckInContext initial) async {
  final popped = <CheckIn?>[];
  await tester.pumpWidget(MaterialApp(
      theme: mobileTheme(Brightness.light),
      home: Builder(
          builder: (context) => TextButton(
              onPressed: () async => popped.add(await Navigator.push<CheckIn>(
                  context,
                  MaterialPageRoute(
                      builder: (_) =>
                          CheckInScreen(service: s, initial: initial)))),
              child: const Text('abrir')))));
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
  return popped;
}

// A focused field scrolls itself back into view; close the keyboard first.
Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

void main() {
  test('context: window, pending days, training label and strict scales', () {
    final ctx = CheckInContext(contextFixture());
    expect(ctx.missing, ['2026-11-02']);
    expect(ctx.trainingLabel, 'Tren inferior · entrenamiento registrado');
    expect(relativeDayLabel('2026-11-03', ctx.today), 'Ayer');
    final bad = contextFixture(checkIn: {
      'id': 'c',
      'localDate': '2026-11-04',
      'revision': 1,
      'stress': 6
    });
    expect(() => CheckInContext(bad), throwsFormatException);
    final ok = CheckInContext(contextFixture(checkIn: {
      'id': 'c',
      'localDate': '2026-11-04',
      'revision': 1,
      'bodyWeightKg': 71.4,
      'nutritionCompliance': 'partial'
    }));
    expect([ok.checkIn!.bodyWeightKg, ok.checkIn!.sleepHours], [71.4, null]);
  });

  test('shared progress omits hidden categories instead of sending empty lists',
      () {
    final hidden = SharedProgress({
      'visibility': {'measurements': false, 'adherence': false}
    });
    expect([hidden.measurements, hidden.training], [null, null]);
    final shared = SharedProgress({
      'visibility': {'measurements': true, 'adherence': true},
      'measurements': [
        {
          'date': '2026-11-01',
          'weightKg': 70.5,
          'waistCm': 80,
          'hipCm': null,
          'bodyFatPercentage': null
        }
      ],
      'adherence': {
        'training': {
          'applicableDays': 5,
          'recordedDays': 4,
          'observedPercent': 100,
          'coveragePercent': 80
        },
        'nutrition': {
          'applicableDays': 0,
          'recordedDays': 0,
          'observedPercent': null,
          'coveragePercent': null
        },
      },
    });
    expect([
      shared.measurements!.single.waistCm,
      shared.training!.coveragePercent,
      shared.nutrition!.observedPercent
    ], [
      80,
      80,
      null
    ]);
  });

  testWidgets(
      'weight validation, offline retry with the same key and confirmed save at 320 px',
      (tester) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    final requests = <ApiHttpRequest>[];
    var offline = true;
    final s = service((request) async {
      requests.add(request);
      if (offline) {
        offline = false;
        return const ApiHttpResponse(statusCode: 503, body: {
          'error': {'code': 'SERVICE_UNAVAILABLE', 'message': 'Sin conexión'}
        });
      }
      return ApiHttpResponse(statusCode: 200, body: saved(request.body!));
    });
    final popped =
        await open(tester, s, CheckInContext(contextFixture(nutrition: true)));
    expect(tester.takeException(), isNull);
    expect(
        find.text('Tren inferior · entrenamiento registrado'), findsOneWidget);
    await tester.ensureVisible(find.byType(TextField).first);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '70,55');
    await tapVisible(tester, find.text('Guardar check-in'));
    await tester.pumpAndSettle();
    expect(find.textContaining('entre 30 y 300 kg'), findsOneWidget);
    expect(requests, isEmpty);
    await tester.ensureVisible(find.byType(TextField).first);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '70,5');
    await tapVisible(tester, find.bySemanticsLabel('Energía 4 de 5, Alta'));
    await tapVisible(tester, find.text('A medias'));
    await tapVisible(tester, find.text('Guardar check-in'));
    await tester.pumpAndSettle();
    // No false success: still on the form with the error and the data kept.
    expect(popped, isEmpty);
    expect(find.textContaining('No se guardó'), findsOneWidget);
    await tapVisible(tester, find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(requests.length, 2);
    expect(requests[0].headers['Idempotency-Key'],
        requests[1].headers['Idempotency-Key']);
    expect(requests[1].body, containsPair('bodyWeightKg', 70.5));
    expect(requests[1].body, containsPair('energy', 4));
    expect(requests[1].body, containsPair('nutritionCompliance', 'partial'));
    expect(requests[1].body, containsPair('revision', 0));
    expect(popped.single?.bodyWeightKg, 70.5);
  });

  testWidgets('a conflict reloads the latest version instead of overwriting it',
      (tester) async {
    final existing = {
      'id': 'c',
      'localDate': '2026-11-04',
      'revision': 2,
      'sleepHours': 8.0
    };
    final s = service((request) async => request.method == 'POST'
        ? const ApiHttpResponse(statusCode: 409, body: {
            'error': {'code': 'CHECK_IN_CONFLICT', 'message': 'Cambió'}
          })
        : ApiHttpResponse(
            statusCode: 200,
            body: contextFixture(
                checkIn: {...existing, 'revision': 3, 'sleepHours': 6.5})));
    final popped = await open(
        tester, s, CheckInContext(contextFixture(checkIn: existing)));
    expect(find.text('8 h'), findsWidgets);
    await tapVisible(tester, find.text('Guardar corrección'));
    await tester.pumpAndSettle();
    expect(popped, isEmpty);
    expect(find.textContaining('cambió en otro dispositivo'), findsOneWidget);
    expect(find.text('6,5 h'), findsWidgets);
  });

  testWidgets('sleep field clears back to empty (not 0 h)', (tester) async {
    final s = service((request) async =>
        ApiHttpResponse(statusCode: 200, body: saved(request.body!)));
    await open(tester, s, CheckInContext(contextFixture()));
    await tapVisible(tester, find.text('7,5 h'));
    await tester.pumpAndSettle();
    expect(find.text('7,5 h'), findsWidgets);
    await tapVisible(tester, find.byTooltip('Borrar horas de sueño'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Sin dato de sueño'), findsOneWidget);
    expect(find.byTooltip('Borrar horas de sueño'), findsNothing);
  });

  testWidgets('Progreso tells hidden apart from empty and shows own weight',
      (tester) async {
    final s = service((request) async => ApiHttpResponse(
        statusCode: 200,
        body: request.path.startsWith('/api/me/progress')
            ? const {
                'visibility': {'measurements': false, 'adherence': false}
              }
            : const {
                'checkIns': [
                  {
                    'id': 'b',
                    'localDate': '2026-11-04',
                    'revision': 1,
                    'bodyWeightKg': 70.8
                  },
                  {
                    'id': 'a',
                    'localDate': '2026-11-01',
                    'revision': 1,
                    'bodyWeightKg': 71.6
                  },
                ],
                'nextOffset': null
              }));
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.dark),
        home: Scaffold(
            body: ListView(children: [FollowUpProgress(service: s)]))));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('70,8 kg'), findsOneWidget);
    expect(find.textContaining('−0,8 kg'), findsOneWidget);
    expect(find.textContaining('aún no comparte'), findsOneWidget);
  });

  testWidgets(
      'Progreso charts shared evaluations, shows adherence coverage and discards on revocation',
      (tester) async {
    var shared = true;
    final s = service((request) async {
      if (request.path.startsWith('/api/me/progress')) {
        return ApiHttpResponse(
            statusCode: 200,
            body: shared
                ? const {
                    'visibility': {'measurements': true, 'adherence': true},
                    'measurements': [
                      {
                        'date': '2026-11-04',
                        'weightKg': 70.0,
                        'waistCm': 79.0,
                        'hipCm': null,
                        'bodyFatPercentage': null,
                        'source': 'professional_evaluation',
                        'method': 'perimetros'
                      },
                      {
                        'date': '2026-10-04',
                        'weightKg': 71.5,
                        'waistCm': 81.0,
                        'hipCm': null,
                        'bodyFatPercentage': null,
                        'source': 'professional_evaluation',
                        'method': 'perimetros'
                      },
                    ],
                    'adherence': {
                      'training': {
                        'applicableDays': 5,
                        'recordedDays': 4,
                        'observedPercent': 100,
                        'coveragePercent': 80
                      },
                      'nutrition': {
                        'applicableDays': 0,
                        'recordedDays': 0,
                        'observedPercent': null,
                        'coveragePercent': null
                      },
                    },
                  }
                : const {
                    'visibility': {'measurements': false, 'adherence': false}
                  });
      }
      return const ApiHttpResponse(
          statusCode: 200, body: {'checkIns': [], 'nextOffset': null});
    });
    var reloadKey = 0;
    late StateSetter rebuild;
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: StatefulBuilder(builder: (context, setState) {
          rebuild = setState;
          return Scaffold(
              body: ListView(children: [
            FollowUpProgress(key: ValueKey(reloadKey), service: s)
          ]));
        })));
    await tester.pumpAndSettle();
    expect(find.text('Evaluación profesional'), findsOneWidget);
    expect(
        find.textContaining('2 evaluaciones en tu historial'), findsOneWidget);
    expect(find.textContaining('cobertura 80 %'), findsOneWidget);
    shared = false;
    rebuild(() => reloadKey++);
    await tester.pumpAndSettle();
    expect(find.text('Evaluación profesional'), findsNothing);
    expect(find.textContaining('aún no comparte'), findsOneWidget);
  });

  testWidgets(
      'HU-035 Inicio shows check-in and nutrition independently when training fails or plans are missing',
      (tester) async {
    var failTraining = true;
    final api = ApiClient(
        sessionStorage: InMemorySessionStorage(
            initialSession: StoredSession(
                accessToken: 't',
                refreshToken: 't',
                expiresAt: DateTime.utc(2040))),
        httpHandler: (request) async {
          if (request.path.startsWith('/api/me/check-ins/context')) {
            return ApiHttpResponse(statusCode: 200, body: contextFixture());
          }
          if (request.path.startsWith('/api/me/nutrition-plan')) {
            return const ApiHttpResponse(statusCode: 200, body: {'plan': null});
          }
          if (request.path.startsWith('/api/me/training-history')) {
            return const ApiHttpResponse(
                statusCode: 200, body: {'sessions': [], 'nextOffset': null});
          }
          if (failTraining) {
            return const ApiHttpResponse(statusCode: 503, body: {
              'error': {'code': 'QUERY_FAILED', 'message': 'Rutina caída'}
            });
          }
          return const ApiHttpResponse(statusCode: 200, body: {
            'clientId': 'client-a',
            'localDate': '2026-11-04',
            'today': '2026-11-04',
            'timeZone': 'America/Mexico_City',
            'canWrite': true,
            'activeRevision': 0,
            'dayId': null,
            'session': null,
            'plan': null,
          });
        });
    final profile = ClientProfile.fromJson({
      'id': 'client-a',
      'userId': 'user-a',
      'fullName': 'Sofía Cliente',
      'status': 'active',
    });
    await tester.pumpWidget(MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: ClientShell(
            profile: profile,
            service: TrainingService(apiClient: api, cache: TrainingCache()),
            nutritionService:
                NutritionService(apiClient: api, cache: NutritionCache()),
            checkInService: CheckInService(apiClient: api))));
    await tester.pumpAndSettle();
    expect(find.text('Check-in de hoy'), findsOneWidget);
    expect(find.text('Rutina caída'), findsOneWidget);
    expect(find.text('Alimentación de hoy'), findsOneWidget);
    expect(find.textContaining('Sin plan alimenticio activo'), findsOneWidget);

    failTraining = false;
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Todavía no tienes una rutina asignada'), findsOneWidget);
    expect(find.text('Check-in de hoy'), findsOneWidget);
    expect(find.text('Alimentación de hoy'), findsOneWidget);
  });
}

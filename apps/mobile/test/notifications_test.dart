import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/auth_service.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/client/services/client_profile_service.dart';
import 'package:couchonefit_mobile/features/notifications/models/notification_models.dart';
import 'package:couchonefit_mobile/features/notifications/services/notification_service.dart';
import 'package:couchonefit_mobile/features/notifications/widgets/notification_settings_panel.dart';
import 'package:couchonefit_mobile/features/nutrition/models/nutrition_plan.dart';
import 'package:couchonefit_mobile/features/settings/models/app_settings.dart';
import 'package:couchonefit_mobile/features/settings/services/settings_controller.dart';
import 'package:couchonefit_mobile/features/training/models/training.dart';
import 'package:couchonefit_mobile/features/training/screens/client_shell.dart';
import 'package:couchonefit_mobile/features/training/screens/training_session_screen.dart';
import 'package:couchonefit_mobile/features/training/services/training_service.dart';
import 'package:couchonefit_mobile/routes/client_session_gate.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> _trainingFixture() => {
      'clientId': 'client-a',
      'localDate': '2026-11-23',
      'today': '2026-11-23',
      'timeZone': 'America/Mexico_City',
      'canWrite': true,
      'activeRevision': 1,
      'dayId': 'day-1',
      'session': null,
      'plan': {
        'id': 'version-1',
        'clientId': 'client-a',
        'number': 1,
        'published': true,
        'name': 'Fuerza base',
        'schedule': 'cycle',
        'startDate': '2026-11-23',
        'days': [
          {
            'id': 'day-1',
            'name': 'Tren superior',
            'kind': 'training',
            'date': null,
            'exercises': [
              {
                'id': 'ex-1',
                'name': 'Press inclinado',
                'instructions': 'Controla la bajada.',
                'loadMode': 'external',
                'restSeconds': 60,
                'guidance': <String>[],
                'images': <String>[],
                'sets': [
                  {
                    'id': 'set-1',
                    'reps': 10,
                    'repsMax': 12,
                    'rpe': 8.0,
                    'rir': null,
                    'targetLoadKg': 40.0,
                  },
                  {
                    'id': 'set-2',
                    'reps': 10,
                    'repsMax': 12,
                    'rpe': 8.0,
                    'rir': null,
                    'targetLoadKg': 40.0,
                  },
                ],
              }
            ],
          }
        ],
      },
    };

Map<String, dynamic> _nutritionPlanJson() => {
      'id': '11111111-1111-4111-8111-111111111111',
      'planId': '22222222-2222-4222-8222-222222222222',
      'number': 1,
      'name': 'Plan diario',
      'createdAt': '2026-11-23T08:00:00.000Z',
      'caloriesTarget': 2100,
      'proteinTargetG': 150,
      'carbsTargetG': 220,
      'fatTargetG': 65,
      'meals': [
        {
          'id': 'm1',
          'name': 'Desayuno',
          'scheduleTime': '08:00',
          'targetCalories': 550,
          'items': [
            {'id': 'i1', 'name': 'Huevos', 'quantity': 3, 'unit': 'pza'},
            {'id': 'i2', 'name': 'Avena', 'quantity': 60, 'unit': 'g'},
            {'id': 'i3', 'name': 'Plátano', 'quantity': 1, 'unit': 'pza'},
          ],
        },
        {
          'id': 'm2',
          'name': 'Comida',
          'scheduleTime': '1:30 p.m.',
          'items': [
            {'id': 'i4', 'name': 'Pollo', 'quantity': 160, 'unit': 'g'},
          ],
        },
        {
          'id': 'm3',
          'name': 'Pre-entreno',
          'scheduleTime': '60 min pre',
          'items': [
            {'id': 'i5', 'name': 'Manzana', 'quantity': 1, 'unit': 'pza'},
          ],
        },
      ],
    };

final _profile = ClientProfile.fromJson({
  'id': 'client-a',
  'userId': 'user-a',
  'professionalId': 'pro-a',
  'fullName': 'Sofía Cliente',
  'status': 'active',
  'username': 'sofia',
  'email': 'sofia@example.com',
});

ApiClient _api(JsonHttpHandler handler) => ApiClient(
      sessionStorage: InMemorySessionStorage(
        initialSession: StoredSession(
          accessToken: 'test',
          refreshToken: 'test',
          expiresAt: DateTime.utc(2040),
        ),
      ),
      httpHandler: handler,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('couchonefit/notifications');
  late List<MethodCall> calls;
  late bool systemEnabled;
  late bool exactAlarms;

  setUp(() {
    calls = [];
    systemEnabled = true;
    exactAlarms = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (call.method == 'requestPermission' || call.method == 'areEnabled') {
        return systemEnabled;
      }
      if (call.method == 'canScheduleExactAlarms') return exactAlarms;
      if (call.method == 'consumePendingLaunchTarget') {
        return null;
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  Future<void> emitNative(String method, Map<String, Object?> args) async {
    await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .handlePlatformMessage(
      channel.name,
      const StandardMethodCodec().encodeMethodCall(MethodCall(method, args)),
      (_) {},
    );
  }

  test('parseMealScheduleTime parses 24h, 12h and ranges, and rejects relative',
      () {
    expect(parseMealScheduleTime('08:00'), const MealTimeOfDay(8, 0));
    expect(parseMealScheduleTime('8:05'), const MealTimeOfDay(8, 5));
    expect(parseMealScheduleTime('23:59'), const MealTimeOfDay(23, 59));
    expect(parseMealScheduleTime('00:00'), const MealTimeOfDay(0, 0));
    expect(parseMealScheduleTime('14:30 hrs'), const MealTimeOfDay(14, 30));
    expect(parseMealScheduleTime('~09:15'), const MealTimeOfDay(9, 15));

    expect(parseMealScheduleTime('8:00 AM'), const MealTimeOfDay(8, 0));
    expect(parseMealScheduleTime('1:30 p.m.'), const MealTimeOfDay(13, 30));
    expect(parseMealScheduleTime('12:00 pm'), const MealTimeOfDay(12, 0));
    expect(parseMealScheduleTime('12:00 am'), const MealTimeOfDay(0, 0));
    expect(parseMealScheduleTime('8 am'), const MealTimeOfDay(8, 0));

    expect(parseMealScheduleTime('08:00 - 09:00'), const MealTimeOfDay(8, 0));
    expect(
        parseMealScheduleTime('1:00 pm a 2:00 pm'), const MealTimeOfDay(13, 0));

    expect(
      const MealTimeOfDay(0, 10).subtractMinutes(15),
      const MealTimeOfDay(23, 55),
    );

    expect(parseMealScheduleTime(null), isNull);
    expect(parseMealScheduleTime('   '), isNull);
    expect(parseMealScheduleTime('60 min pre'), isNull);
    expect(parseMealScheduleTime('30 min antes'), isNull);
    expect(parseMealScheduleTime('Post entreno'), isNull);
    expect(parseMealScheduleTime('Al despertar'), isNull);
    expect(parseMealScheduleTime('25:00'), isNull);
    expect(parseMealScheduleTime('13:00 pm'), isNull);
    expect(parseMealScheduleTime('14:99'), isNull);
  });

  test('buildMealReminders computes lead times and previews', () {
    final plan = NutritionPlan.fromJson(_nutritionPlanJson());
    final reminders = buildMealReminders(plan, leadMinutes: 15);
    expect(reminders.length, 2);
    expect(reminders[0].name, 'Desayuno');
    expect(reminders[0].scheduleLabel, '08:00');
    expect(reminders[0].triggerTime, const MealTimeOfDay(7, 45));
    expect(reminders[0].preview, 'Huevos, Avena y 1 más · 550 kcal');
    expect(reminders[1].name, 'Comida');
    expect(reminders[1].scheduleLabel, '13:30');
    expect(reminders[1].triggerTime, const MealTimeOfDay(13, 15));
    expect(reminders[1].preview, 'Pollo');

    final exact = buildMealReminders(plan, leadMinutes: 0);
    expect(exact[0].triggerTime, const MealTimeOfDay(8, 0));
  });

  test('AppSettings preserves notification preferences and falls back safely',
      () {
    const updated = AppSettings(
      workoutNotification: false,
      mealReminders: true,
      mealReminderLeadMinutes: 30,
    );
    final decoded = AppSettings.fromJson(updated.toJson());
    expect(decoded.workoutNotification, isFalse);
    expect(decoded.mealReminders, isTrue);
    expect(decoded.mealReminderLeadMinutes, 30);

    final legacy = AppSettings.fromJson({'themeMode': 'dark'});
    expect(legacy.workoutNotification, isTrue);
    expect(legacy.mealReminders, isTrue);
    expect(legacy.mealReminderLeadMinutes, 15);

    final invalid = AppSettings.fromJson({'mealReminderLeadMinutes': 99});
    expect(invalid.mealReminderLeadMinutes, 15);
  });

  test('NotificationService deduplicates syncs and forwards incoming actions',
      () async {
    final service = NotificationService(channel: channel);
    addTearDown(service.dispose);

    const state = WorkoutNotificationState(
      dayName: 'Tren superior',
      startedAtMs: 1000,
      completedSets: 0,
      totalSets: 2,
      exerciseName: 'Press inclinado',
      nextSetNumber: 1,
      exerciseTotalSets: 2,
      nextSetSummary: '40 kg × 10 reps',
    );
    await service.syncWorkout(state);
    await service.syncWorkout(state);
    expect(
      calls.where((c) => c.method == 'showWorkoutNotification').length,
      1,
    );
    await service.syncWorkout(state, force: true);
    expect(
      calls.where((c) => c.method == 'showWorkoutNotification').length,
      2,
    );

    await service.clearWorkout();
    expect(
      calls.where((c) => c.method == 'cancelWorkoutNotification').length,
      1,
    );

    final plan = NutritionPlan.fromJson(_nutritionPlanJson());
    await service.syncMealReminders(plan, const AppSettings());
    await service.syncMealReminders(plan, const AppSettings());
    expect(
      calls.where((c) => c.method == 'scheduleMealReminders').length,
      1,
    );
    expect(service.scheduledMeals.value.length, 2);
    expect(service.skippedMealsCount.value, 1);

    await service.syncMealReminders(
      plan,
      const AppSettings(mealReminders: false),
    );
    expect(
      calls.where((c) => c.method == 'cancelMealReminders').length,
      1,
    );

    final actions = <WorkoutNotificationAction>[];
    final navs = <String>[];
    final sub1 = service.workoutActions.listen(actions.add);
    final sub2 = service.navigationTargets.listen(navs.add);
    addTearDown(() async {
      await sub1.cancel();
      await sub2.cancel();
    });

    await emitNative('onWorkoutAction', {'action': 'complete_set'});
    await emitNative('onNavigate', {'target': 'nutrition'});
    await Future<void>.delayed(Duration.zero);

    expect(actions, [WorkoutNotificationAction.completeSet]);
    expect(navs, ['nutrition']);
  });

  testWidgets(
      'TrainingSessionScreen syncs notification and reacts to notification buttons',
      (tester) async {
    final notif = NotificationService(channel: channel);
    addTearDown(notif.dispose);
    var now = DateTime(2026, 11, 23, 9, 0, 0);
    final service = TrainingService(
      apiClient: _api((request) async {
        if (request.method == 'POST' &&
            request.path == '/api/me/training-sessions') {
          return const ApiHttpResponse(statusCode: 200, body: {
            'session': {
              'id': 's1',
              'status': 'finalized',
              'revision': 1,
              'results': [
                {
                  'setId': 'set-1',
                  'state': 'performed',
                  'reps': 10,
                  'loadKg': 40.0,
                  'rpe': null,
                  'rir': null,
                },
                {
                  'setId': 'set-2',
                  'state': 'performed',
                  'reps': 10,
                  'loadKg': 40.0,
                  'rpe': null,
                  'rir': null,
                },
              ],
            }
          });
        }
        return ApiHttpResponse(statusCode: 200, body: _trainingFixture());
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.dark),
        home: TrainingSessionScreen(
          contextData: TrainingContext(_trainingFixture()),
          service: service,
          clock: () => now,
          notificationService: notif,
        ),
      ),
    );
    await tester.pumpAndSettle();

    Map<String, Object?> lastWorkoutArgs() {
      final call =
          calls.lastWhere((c) => c.method == 'showWorkoutNotification');
      return Map<String, Object?>.from(call.arguments as Map);
    }

    expect(lastWorkoutArgs()['completedSets'], 0);
    expect(lastWorkoutArgs()['nextSetNumber'], 1);
    expect(lastWorkoutArgs()['restActive'], false);

    final countBeforePause =
        calls.where((c) => c.method == 'showWorkoutNotification').length;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(
      calls.where((c) => c.method == 'showWorkoutNotification').length,
      greaterThan(countBeforePause),
    );
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();

    await emitNative('onWorkoutAction', {'action': 'complete_set'});
    await tester.pump();
    expect(lastWorkoutArgs()['completedSets'], 1);
    expect(lastWorkoutArgs()['nextSetNumber'], 2);
    expect(lastWorkoutArgs()['restActive'], true);
    final initialEnd = lastWorkoutArgs()['restEndAtMs'] as int;

    await emitNative('onWorkoutAction', {'action': 'rest_add_15'});
    await tester.pump();
    expect(lastWorkoutArgs()['restEndAtMs'], initialEnd + 15000);

    await emitNative('onWorkoutAction', {'action': 'rest_toggle_pause'});
    await tester.pump();
    expect(lastWorkoutArgs()['restPaused'], true);

    await emitNative('onWorkoutAction', {'action': 'rest_toggle_pause'});
    await tester.pump();
    expect(lastWorkoutArgs()['restPaused'], false);

    await emitNative('onWorkoutAction', {'action': 'rest_skip'});
    await tester.pump();
    expect(lastWorkoutArgs()['restActive'], false);

    await emitNative('onWorkoutAction', {'action': 'complete_set'});
    await tester.pump();
    expect(lastWorkoutArgs()['completedSets'], 2);
    expect(lastWorkoutArgs()['nextSetNumber'], isNull);

    await tester.tap(find.text('Finalizar'));
    await tester.pumpAndSettle();
    expect(
      calls.any((c) => c.method == 'cancelWorkoutNotification'),
      isTrue,
    );
  });

  testWidgets('TrainingSessionScreen respects workoutNotification disabled',
      (tester) async {
    final notif = NotificationService(channel: channel);
    addTearDown(notif.dispose);
    final service = TrainingService(
      apiClient: _api((_) async =>
          ApiHttpResponse(statusCode: 200, body: _trainingFixture())),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: TrainingSessionScreen(
          contextData: TrainingContext(_trainingFixture()),
          service: service,
          settings: const AppSettings(workoutNotification: false),
          notificationService: notif,
        ),
      ),
    );
    await tester.pump();
    expect(
      calls.where((c) => c.method == 'showWorkoutNotification'),
      isEmpty,
    );
  });

  testWidgets(
      'ClientShell schedules meal reminders, navigates from notification, and settings panel updates',
      (tester) async {
    final notif = NotificationService(channel: channel);
    addTearDown(notif.dispose);
    final settings = SettingsController();
    addTearDown(settings.dispose);

    final client = _api((request) async {
      if (request.path.startsWith('/api/me/nutrition-plan')) {
        return ApiHttpResponse(
          statusCode: 200,
          body: {'plan': _nutritionPlanJson()},
        );
      }
      if (request.path.startsWith('/api/me/training-history')) {
        return const ApiHttpResponse(
            statusCode: 200, body: {'sessions': [], 'nextOffset': null});
      }
      if (request.path.startsWith('/api/me/check-ins/context')) {
        return const ApiHttpResponse(statusCode: 200, body: {
          'clientId': 'client-a',
          'today': '2026-11-23',
          'timeZone': 'America/Mexico_City',
          'canWrite': true,
          'dates': [
            {'localDate': '2026-11-23', 'recorded': false}
          ],
          'checkIn': null,
          'nutrition': {'applicable': true, 'planName': 'Plan diario'},
          'training': null,
        });
      }
      return ApiHttpResponse(statusCode: 200, body: _trainingFixture());
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.dark),
        home: ClientShell(
          profile: _profile,
          service: TrainingService(apiClient: client),
          settings: settings,
          notificationService: notif,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final scheduled =
        calls.where((c) => c.method == 'scheduleMealReminders').toList();
    expect(scheduled, isNotEmpty);
    final args = Map<String, Object?>.from(scheduled.last.arguments as Map);
    expect(args['leadMinutes'], 15);
    expect((args['meals'] as List).length, 2);

    await emitNative('onNavigate', {'target': 'nutrition'});
    await tester.pumpAndSettle();
    expect(find.text('Plan diario'), findsWidgets);

    // Open NotificationSettingsPanel and change lead time to 30 min.
    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: Scaffold(
          body: SingleChildScrollView(
            child: NotificationSettingsPanel(
              controller: settings,
              notificationService: notif,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('2 comidas con horario programado'),
        findsOneWidget);
    await tester.tap(find.text('30 min'));
    await tester.pumpAndSettle();
    expect(settings.value.mealReminderLeadMinutes, 30);
  });

  testWidgets('NotificationSettingsPanel shows permission banner when disabled',
      (tester) async {
    systemEnabled = false;
    final notif = NotificationService(channel: channel);
    addTearDown(notif.dispose);
    final settings = SettingsController();
    addTearDown(settings.dispose);

    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: Scaffold(
          body: NotificationSettingsPanel(
            controller: settings,
            notificationService: notif,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Activar permisos'), findsOneWidget);
  });

  testWidgets('NotificationSettingsPanel asks for exact alarms for meals',
      (tester) async {
    exactAlarms = false;
    final notif = NotificationService(channel: channel);
    addTearDown(notif.dispose);
    final settings = SettingsController();
    addTearDown(settings.dispose);

    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: Scaffold(
          body: NotificationSettingsPanel(
            controller: settings,
            notificationService: notif,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Permitir'));
    expect(calls.last.method, 'openExactAlarmSettings');

    // Without meal reminders the exact-alarm notice is irrelevant.
    await settings.update(settings.value.copyWith(mealReminders: false));
    await tester.pumpAndSettle();
    expect(find.text('Permitir'), findsNothing);
  });

  testWidgets('ClientSessionGate clears notifications on logout',
      (tester) async {
    final notif = NotificationService(channel: channel);
    addTearDown(notif.dispose);
    final storage = InMemorySessionStorage(
      initialSession: StoredSession(
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: DateTime.utc(2040),
      ),
    );
    final client = ApiClient(
      sessionStorage: storage,
      httpHandler: (request) async {
        if (request.path == '/api/auth/session') {
          return const ApiHttpResponse(statusCode: 200, body: {
            'account': {
              'id': 'user-a',
              'role': 'client',
              'status': 'active',
              'clientId': 'client-a',
              'username': 'sofia',
              'email': 'sofia@example.com',
            },
          });
        }
        if (request.path == '/api/me/record') {
          return ApiHttpResponse(
            statusCode: 200,
            body: {'record': _profile.toJson()},
          );
        }
        if (request.path == '/api/auth/logout') {
          return const ApiHttpResponse(statusCode: 200, body: {'ok': true});
        }
        if (request.path.startsWith('/api/me/nutrition-plan')) {
          return const ApiHttpResponse(statusCode: 200, body: {'plan': null});
        }
        if (request.path.startsWith('/api/me/training-history')) {
          return const ApiHttpResponse(
              statusCode: 200, body: {'sessions': [], 'nextOffset': null});
        }
        if (request.path.startsWith('/api/me/check-ins/context')) {
          return const ApiHttpResponse(statusCode: 200, body: {
            'clientId': 'client-a',
            'today': '2026-11-23',
            'timeZone': 'America/Mexico_City',
            'canWrite': true,
            'dates': [
              {'localDate': '2026-11-23', 'recorded': false}
            ],
            'checkIn': null,
            'nutrition': {'applicable': false, 'planName': null},
            'training': null,
          });
        }
        return ApiHttpResponse(statusCode: 200, body: _trainingFixture());
      },
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: mobileTheme(Brightness.light),
        home: ClientSessionGate(
          onThemeChanged: (_) {},
          authService: AuthService(apiClient: client, sessionStorage: storage),
          profileService: ClientProfileService(apiClient: client),
          trainingService: TrainingService(apiClient: client),
          notificationService: notif,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cuenta'));
    await tester.pumpAndSettle();
    final logout = find.byKey(const ValueKey('logout_button'));
    await tester.ensureVisible(logout);
    await tester.tap(logout);
    await tester.pumpAndSettle();

    expect(calls.any((c) => c.method == 'cancelAll'), isTrue);
  });
}

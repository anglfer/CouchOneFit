import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/nutrition/models/nutrition_plan.dart';
import 'package:couchonefit_mobile/features/nutrition/widgets/nutrition_plan_view.dart';
import 'package:couchonefit_mobile/features/training/screens/client_shell.dart';
import 'package:couchonefit_mobile/features/training/services/training_service.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:couchonefit_mobile/shared/theme/app_theme.dart';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> enrichedNutritionJson() => {
      'id': '11111111-1111-4111-8111-111111111111',
      'planId': '22222222-2222-4222-8222-222222222222',
      'clientId': 'client-a',
      'number': 2,
      'revision': 1,
      'published': true,
      'createdAt': '2026-11-19T12:00:00.000Z',
      'name': 'Plan recomposición avanzado',
      'caloriesTarget': 2250,
      'proteinTargetG': 165,
      'carbsTargetG': 250,
      'fatTargetG': 65,
      'fiberTargetG': 35,
      'hydrationTargetMl': 2500,
      'generalInstructions': 'Prioriza 80% alimentos enteros y pesa en crudo.',
      'restDayTargets': {
        'caloriesTarget': 1980,
        'proteinTargetG': 165,
        'carbsTargetG': 190,
        'fatTargetG': 62,
      },
      'periWorkout': {
        'preCarbsG': 50,
        'preProteinG': 35,
        'preFatG': 10,
        'postCarbsG': 60,
        'postProteinG': 35,
        'postFatG': 10,
        'intraCarbsG': 0,
        'notes': 'Consumir pre-entreno 60 min antes de entrenar.',
      },
      'meals': [
        {
          'id': '33333333-3333-4333-8333-333333333333',
          'name': 'Desayuno energético',
          'scheduleTime': '08:00',
          'category': 'breakfast',
          'instructions': 'Acompañar con café negro o té sin azúcar.',
          'targetCalories': 580,
          'targetProteinG': 42,
          'targetCarbsG': 65,
          'targetFatG': 16,
          'items': [
            {
              'id': '44444444-4444-4444-8444-444444444444',
              'name': 'Pechuga de pollo',
              'quantity': 150,
              'unit': 'g',
              'instructions': 'Peso en crudo a la plancha',
              'foodGroup': 'Proteínas',
              'substitutes': 'Pavo, pescado blanco o tofu firme',
              'calories': 165,
              'proteinG': 34.5,
              'carbsG': 0,
              'fatG': 2.3,
            },
            {
              'id': '55555555-5555-4555-8555-555555555555',
              'name': 'Avena en hojuelas',
              'quantity': 60,
              'unit': 'g',
              'instructions': 'En seco',
              'foodGroup': 'Carbohidratos',
              'substitutes': '2 rebanadas de pan integral',
              'calories': 227,
              'proteinG': 7.9,
              'carbsG': 40.6,
              'fatG': 3.9,
            },
          ],
        },
      ],
    };

Map<String, Object?> legacyNutritionJson() => {
      'id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'planId': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'number': 1,
      'name': 'Plan básico heredado',
      'createdAt': '2026-11-10T10:00:00.000Z',
      'caloriesTarget': null,
      'proteinTargetG': null,
      'carbsTargetG': null,
      'fatTargetG': null,
      'meals': [
        {
          'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          'name': 'Comida 1',
          'instructions': null,
          'items': [
            {
              'id': 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              'name': 'Huevo entero',
              'quantity': 3,
              'unit': 'pza',
              'instructions': null,
            }
          ],
        }
      ],
    };

Widget host(Widget child, Brightness brightness) => MaterialApp(
      theme: mobileTheme(brightness),
      home: Scaffold(body: SingleChildScrollView(child: child)),
    );

void main() {
  test('parsea planes heredados y enriquecidos sin romper compatibilidad', () {
    final legacy = NutritionPlan.fromJson(legacyNutritionJson());
    expect(legacy.name, 'Plan básico heredado');
    expect(legacy.hasMacros, isFalse);
    expect(legacy.hasRestDayTargets, isFalse);
    expect(legacy.hasPeriWorkout, isFalse);
    expect(legacy.meals.single.items.single.quantityLabel, '3 pza');

    final enriched = NutritionPlan.fromJson(enrichedNutritionJson());
    expect(enriched.hasMacros, isTrue);
    expect(enriched.hasRestDayTargets, isTrue);
    expect(enriched.hasPeriWorkout, isTrue);
    expect(enriched.hydrationLabel, '2.5 L');
    expect(enriched.meals.single.computedCalories, 392);
    expect(enriched.meals.single.items.first.substitutes,
        'Pavo, pescado blanco o tofu firme');
  });

  testWidgets(
      'NutritionPlanView alterna entreno/descanso, refresca y abre detalle',
      (tester) async {
    var retries = 0;
    final plan = NutritionPlan.fromJson(enrichedNutritionJson());
    await tester.pumpWidget(host(
      NutritionPlanView(
        plan: plan,
        loading: false,
        onRetry: () => retries++,
      ),
      Brightness.dark,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Plan recomposición avanzado'), findsOneWidget);
    expect(find.text('2250'), findsOneWidget);
    expect(find.text('2.5 L'), findsOneWidget);
    expect(find.text('35 g'), findsOneWidget);
    expect(
        find.textContaining('Equivalente: Pavo, pescado blanco o tofu firme'),
        findsOneWidget);

    await tester.tap(find.text('Descanso'));
    await tester.pumpAndSettle();
    expect(find.text('1980'), findsOneWidget);
    expect(find.text('190 g'), findsOneWidget);

    await tester.tap(find.byTooltip('Actualizar plan'));
    expect(retries, 1);

    await tester.ensureVisible(find.text('1. Desayuno energético'));
    await tester.tap(find.text('1. Desayuno energético'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Cerrar'), findsOneWidget);
    await tester.tap(find.byTooltip('Cerrar'));
    await tester.pumpAndSettle();
  });

  testWidgets('NutritionPlanView muestra estados de error y caché offline',
      (tester) async {
    var retries = 0;
    await tester.pumpWidget(host(
      NutritionPlanView(
        plan: null,
        loading: false,
        error: 'Sin conexión',
        cachedAt: DateTime(2026, 11, 19, 10, 30),
        onRetry: () => retries++,
      ),
      Brightness.light,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Sin conexión'), findsOneWidget);
    expect(find.textContaining('Lectura guardada'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    expect(retries, 1);
  });

  for (final width in [320.0, 390.0, 768.0]) {
    for (final theme in Brightness.values) {
      testWidgets('NutritionPlanView sin overflow a $width $theme texto 1.8x',
          (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = 1.8;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          tester.platformDispatcher.clearTextScaleFactorTestValue();
        });

        final plan = NutritionPlan.fromJson(enrichedNutritionJson());
        await tester.pumpWidget(host(
          NutritionPlanView(
            plan: plan,
            loading: false,
            onRetry: () {},
          ),
          theme,
        ));
        await tester.pumpAndSettle();
        final error = tester.takeException();
        expect(error, isNull,
            reason: error is FlutterError ? error.toStringDeep() : '$error');
      });
    }
  }

  testWidgets(
      'HomeTab muestra tarjeta activa de alimentación y navega a Planes',
      (tester) async {
    final api = ApiClient(
      sessionStorage: InMemorySessionStorage(
        initialSession: StoredSession(
          accessToken: 'test',
          refreshToken: 'test',
          expiresAt: DateTime.utc(2040),
        ),
      ),
      httpHandler: (request) async {
        if (request.path.startsWith('/api/me/nutrition-plan')) {
          return ApiHttpResponse(
              statusCode: 200, body: {'plan': enrichedNutritionJson()});
        }
        if (request.path.startsWith('/api/me/training-history')) {
          return const ApiHttpResponse(
              statusCode: 200,
              body: {'sessions': <Object>[], 'nextOffset': null});
        }
        return const ApiHttpResponse(statusCode: 200, body: {
          'clientId': 'client-a',
          'localDate': '2026-11-19',
          'today': '2026-11-19',
          'timeZone': 'America/Mexico_City',
          'canWrite': true,
          'activeRevision': 1,
          'dayId': null,
          'session': null,
          'plan': null,
        });
      },
    );

    final profile = ClientProfile.fromJson({
      'id': 'client-a',
      'userId': 'user-a',
      'fullName': 'Sofía Cliente',
      'status': 'active',
    });

    await tester.pumpWidget(MaterialApp(
      theme: mobileTheme(Brightness.dark),
      home: ClientShell(
        profile: profile,
        service: TrainingService(apiClient: api),
        account: const Text('Cuenta'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Alimentación de hoy'), findsOneWidget);
    expect(find.text('Plan recomposición avanzado'), findsOneWidget);
    await tester.ensureVisible(find.text('Ver plan'));
    await tester.tap(find.text('Ver plan'));
    await tester.pumpAndSettle();

    expect(find.text('2250'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

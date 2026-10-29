import 'dart:async';
import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/features/client/models/client_profile.dart';
import 'package:couchonefit_mobile/features/client/screens/client_profile_screen.dart';
import 'package:couchonefit_mobile/features/client/services/client_profile_service.dart';
import 'package:couchonefit_mobile/main.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const account = <String, Object?>{
  'id': 'user-a', 'clientId': 'record-a', 'role': 'client',
  'status': 'active', 'clientStatus': 'inactive',
};
const record = <String, Object?>{
  'id': 'record-a', 'fullName': 'Sofía 😀', 'username': 'qa020',
  'email': 'qa020@example.com', 'goal': 'Objetivo preparado', 'status': 'inactive',
  'birthDate': '1990-06-15', 'heightCm': 170.5, 'baseWeightKg': 70.2,
  'baseBodyFatPercentage': 20.2, 'waistCm': 80.2, 'hipCm': null,
};
InMemorySessionStorage storage() => InMemorySessionStorage(initialSession:
    StoredSession(accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh',
        expiresAt: DateTime.utc(2040)));
ApiHttpResponse response(Map<String, Object?> data) => ApiHttpResponse(statusCode: 200, body: data);

void main() {
  testWidgets('HU-020 reads prepared base values with units and missing optional data, never edits or pretends progress is empty', (tester) async {
    final profile = ClientProfile.fromJson(record);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ClientProfileScreen(
      profile: profile, onRefresh: () async {}, onLogout: () async {},
    ))));
    await tester.pumpAndSettle();
    expect(find.text('Peso base: 70.2 kg'), findsOneWidget);
    expect(find.text('Grasa medida inicial: 20.2 %'), findsOneWidget);
    expect(find.text('Cintura inicial: 80.2 cm'), findsOneWidget);
    expect(find.text('Cadera inicial: Sin registrar'), findsOneWidget);
    expect(find.text('Fecha de nacimiento: 15/06/1990'), findsOneWidget);
    expect(find.textContaining('todavía no está disponible'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.text('Guardar'), findsNothing);
  });

  test('HU-020 malformed record is a query failure rather than session rejection', () async {
    final api = ApiClient(sessionStorage: storage(), httpHandler: (_) async => response({'record': null}));
    await expectLater(ClientProfileService(apiClient: api).fetchProfile(), throwsA(isA<AuthApiException>()
        .having((error) => error.statusCode, 'status', 503)));
  });

  testWidgets('HU-020 loading and query error differ from login; explicit retry reads the updated same record', (tester) async {
    final pending = Completer<ApiHttpResponse>();
    var reads = 0;
    final api = ApiClient(sessionStorage: storage(), httpHandler: (req) async {
      if (req.path == '/api/auth/session') return response({'account': account});
      if (req.path == '/api/me/record') {
        reads++;
        if (reads == 1) return pending.future;
        if (reads == 2) return const ApiHttpResponse(statusCode: 503);
        return response({'record': {...record, 'goal': 'Objetivo actualizado'}});
      }
      return const ApiHttpResponse(statusCode: 404);
    });
    await tester.pumpWidget(CouchOneFitApp(sessionStorage: storage(), apiClient: api));
    await tester.pump();
    expect(find.byKey(const ValueKey('record-loading')), findsOneWidget);
    pending.complete(response({'record': record}));
    await tester.pumpAndSettle();
    expect(find.text('Objetivo preparado'), findsOneWidget);
    await tester.widget<ClientProfileScreen>(find.byType(ClientProfileScreen)).onRefresh();
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('record-query-error')), findsOneWidget);
    expect(find.text('Objetivo preparado'), findsNothing);
    await tester.tap(find.text('Reintentar consulta'));
    await tester.pumpAndSettle();
    expect(find.text('Objetivo actualizado'), findsOneWidget);
    expect(reads, 3);
  });

  testWidgets('HU-020 another record is never rendered and business 403 is not a definitive session rejection', (tester) async {
    var foreign = true;
    final session = storage();
    final api = ApiClient(sessionStorage: session, httpHandler: (req) async {
      if (req.path == '/api/auth/session') return response({'account': account});
      if (foreign) return response({'record': {...record, 'id': 'record-b', 'fullName': 'Hidden B'}});
      return const ApiHttpResponse(statusCode: 403, body: {'error': {'code': 'BUSINESS_REJECTED', 'message': 'Consulta no disponible.'}});
    });
    await tester.pumpWidget(CouchOneFitApp(sessionStorage: session, apiClient: api));
    await tester.pumpAndSettle();
    expect(find.text('Hidden B'), findsNothing);
    expect(find.byKey(const ValueKey('record-query-error')), findsOneWidget);
    foreign = false;
    await tester.tap(find.text('Reintentar consulta'));
    await tester.pumpAndSettle();
    expect(find.text('Consulta no disponible.'), findsOneWidget);
    expect(await session.readSession(), isNotNull);
  });

  testWidgets('HU-020 definitive session rejection clears the preceding record and stored session', (tester) async {
    var revoked = false;
    final session = storage();
    final api = ApiClient(sessionStorage: session, httpHandler: (req) async {
      if (revoked) return const ApiHttpResponse(statusCode: 401, body: {'error': {'code': 'SESSION_REQUIRED', 'message': 'Tu sesión venció.'}});
      if (req.path == '/api/auth/session') return response({'account': account});
      return response({'record': record});
    });
    await tester.pumpWidget(CouchOneFitApp(sessionStorage: session, apiClient: api));
    await tester.pumpAndSettle();
    expect(find.text('Objetivo preparado'), findsOneWidget);
    revoked = true;
    await tester.widget<ClientProfileScreen>(find.byType(ClientProfileScreen)).onRefresh();
    await tester.pumpAndSettle();
    expect(find.text('Objetivo preparado'), findsNothing);
    expect(find.byType(ClientProfileScreen), findsNothing);
    expect(await session.readSession(), isNull);
    expect(find.byKey(const ValueKey('record-query-error')), findsNothing);
  });
}

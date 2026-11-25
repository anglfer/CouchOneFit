import 'dart:convert';
import 'dart:io';

import 'package:couchonefit_mobile/features/auth/models/session_models.dart';
import 'package:couchonefit_mobile/features/auth/services/auth_service.dart';
import 'package:couchonefit_mobile/features/auth/services/session_storage.dart';
import 'package:couchonefit_mobile/shared/services/api_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('HTTP calls carry distinct API-compatible request ids', () async {
    final ids = <String?>[];
    final api = ApiClient(
      sessionStorage: InMemorySessionStorage(),
      httpHandler: (request) async {
        ids.add(request.headers['X-Request-Id']);
        return const ApiHttpResponse(statusCode: 200);
      },
    );

    await api.getJson('/api/health');
    await api.getJson('/api/health/ready');

    expect(ids, everyElement(matches(RegExp(r'^mob-[a-f0-9]{16}$'))));
    expect(ids.toSet(), hasLength(2));
  });

  test(
      'activation distinguishes refused transport from an actual API rejection',
      () async {
    // flutter_test_config initializes the test binding, whose HttpClient mock
    // answers 400; this test needs the real loopback transport.
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final reservation = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final port = reservation.port;
    await reservation.close(force: true);
    final storage = InMemorySessionStorage();
    final service = AuthService(
      apiClient: ApiClient(
        sessionStorage: storage,
        baseUrl: 'http://127.0.0.1:$port',
      ),
      sessionStorage: storage,
    );

    await expectLater(
      service.activate({}),
      throwsA(isA<AuthApiException>()
          .having((error) => error.statusCode, 'local status', 503)
          .having((error) => error.code, 'code', 'SERVICE_UNAVAILABLE')),
    );
    expect(await storage.readSession(), isNull);

    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
    var calls = 0;
    server.listen((request) async {
      calls++;
      expect(request.method, 'POST');
      expect(request.uri.path, '/api/auth/activation');
      await request.drain<void>();
      request.response
        ..statusCode = 400
        ..headers.contentType = ContentType.json
        ..write(jsonEncode({
          'error': {
            'code': 'INVALID_INPUT',
            'message': 'Escribe un correo válido.',
          },
        }));
      await request.response.close();
    });
    try {
      await expectLater(
        service.activate({}),
        throwsA(isA<AuthApiException>()
            .having((error) => error.statusCode, 'HTTP status', 400)
            .having((error) => error.code, 'code', 'INVALID_INPUT')
            .having((error) => error.message, 'message',
                'Escribe un correo válido.')),
      );
      expect(calls, 1);
      expect(await storage.readSession(), isNull);
    } finally {
      await server.close(force: true);
    }
  });
}

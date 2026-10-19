import 'dart:convert';
import 'dart:io';

import '../../features/auth/models/session_models.dart';
import '../../features/auth/services/session_storage.dart';

class ApiHttpRequest {
  const ApiHttpRequest({
    required this.method,
    required this.path,
    required this.headers,
    this.body,
  });

  final String method;
  final String path;
  final Map<String, String> headers;
  final Map<String, Object?>? body;
}

class ApiHttpResponse {
  const ApiHttpResponse({
    required this.statusCode,
    this.body = const <String, Object?>{},
  });

  final int statusCode;
  final Map<String, Object?> body;
}

typedef JsonHttpHandler = Future<ApiHttpResponse> Function(
    ApiHttpRequest request);

class ApiClient {
  ApiClient({
    required SessionStorage sessionStorage,
    String? baseUrl,
    JsonHttpHandler? httpHandler,
    DateTime Function()? now,
  })  : _sessionStorage = sessionStorage,
        _baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_BASE_URL',
              defaultValue: 'http://10.0.2.2:3000',
            ),
        _httpHandler = httpHandler,
        _now = now;

  final SessionStorage _sessionStorage;
  final String _baseUrl;
  final JsonHttpHandler? _httpHandler;
  final DateTime Function()? _now;
  Future<StoredSession?>? _refreshInFlight;

  DateTime _currentTime() => (_now ?? DateTime.now)().toUtc();

  bool _isExpired(StoredSession session) {
    return !session.expiresAt.toUtc().isAfter(_currentTime());
  }

  Future<Map<String, Object?>> getJson(
    String path, {
    bool authenticated = false,
  }) =>
      requestJson('GET', path, authenticated: authenticated);

  Future<Map<String, Object?>> postJson(
    String path, {
    Map<String, Object?>? body,
    bool authenticated = false,
  }) =>
      requestJson('POST', path, body: body, authenticated: authenticated);

  Future<Map<String, Object?>> requestJson(
    String method,
    String path, {
    Map<String, Object?>? body,
    bool authenticated = false,
  }) async {
    StoredSession? session;
    if (authenticated) {
      session = await _sessionStorage.readSession();
      if (session == null || _isExpired(session)) {
        if (session != null) {
          await _sessionStorage.clearSession();
        }
        throw const AuthApiException(
          statusCode: 401,
          code: 'SESSION_REQUIRED',
          message: 'Tu sesión venció. Inicia sesión de nuevo.',
        );
      }
    }

    var response = await _send(
      method: method,
      path: path,
      body: body,
      accessToken: session?.accessToken,
    );

    if (authenticated && response.statusCode == 401 && session != null) {
      final refreshed = await _rotateSessionOnce(session.refreshToken);
      if (refreshed != null) {
        response = await _send(
          method: method,
          path: path,
          body: body,
          accessToken: refreshed.accessToken,
        );
      } else {
        await _sessionStorage.clearSession();
        throw _extractException(response);
      }
    }

    if (response.statusCode >= 400) {
      if (authenticated &&
          (response.statusCode == 401 || response.statusCode == 403)) {
        await _sessionStorage.clearSession();
      }
      throw _extractException(response);
    }

    return response.body;
  }

  Future<void> logoutSession() async {
    final pendingRefresh = _refreshInFlight;
    if (pendingRefresh != null) {
      try {
        await pendingRefresh;
      } catch (_) {
        // Proceed with logout after in-flight refresh settles.
      }
    }
    final stored = await _sessionStorage.readSession();
    if (stored == null) return;
    final response = await _send(
      method: 'POST',
      path: '/api/auth/client/logout',
      body: <String, Object?>{'refreshToken': stored.refreshToken},
      accessToken: stored.accessToken,
    );
    if (response.statusCode == 204 ||
        response.statusCode == 200 ||
        response.statusCode == 401) {
      await _sessionStorage.clearSession();
      return;
    }
    throw const AuthApiException(
      statusCode: 503,
      code: 'LOGOUT_UNCONFIRMED',
      message:
          'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.',
    );
  }

  Future<StoredSession?> _rotateSessionOnce(String refreshToken) {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final future = _performRefresh(refreshToken);
    _refreshInFlight = future;
    return future.whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<StoredSession?> _performRefresh(String refreshToken) async {
    final response = await _send(
      method: 'POST',
      path: '/api/auth/client/refresh',
      body: <String, Object?>{'refreshToken': refreshToken},
    );
    if (response.statusCode >= 500) {
      throw _extractException(response);
    }
    if (response.statusCode != 200) {
      await _sessionStorage.clearSession();
      return null;
    }
    final rawAccount = response.body['account'];
    final rawSession = response.body['session'];
    if (rawAccount is! Map || rawSession is! Map) {
      await _sessionStorage.clearSession();
      return null;
    }
    final account =
        ClientAccount.fromJson(Map<String, Object?>.from(rawAccount));
    if (account.role != 'client' ||
        account.status != 'active' ||
        account.clientId.isEmpty) {
      await _sessionStorage.clearSession();
      return null;
    }
    final nextSession =
        StoredSession.fromJson(Map<String, Object?>.from(rawSession));
    if (_isExpired(nextSession)) {
      await _sessionStorage.clearSession();
      return null;
    }
    await _sessionStorage.saveSession(nextSession);
    return nextSession;
  }

  AuthApiException _extractException(ApiHttpResponse response) {
    final rawError = response.body['error'];
    if (rawError is Map) {
      final code = rawError['code'];
      final message = rawError['message'];
      return AuthApiException(
        statusCode: response.statusCode,
        code: code is String && code.isNotEmpty ? code : 'REQUEST_FAILED',
        message: message is String && message.isNotEmpty
            ? message
            : 'No pudimos completar la solicitud.',
      );
    }
    return AuthApiException(
      statusCode: response.statusCode,
      code: 'REQUEST_FAILED',
      message: 'No pudimos completar la solicitud.',
    );
  }

  Future<ApiHttpResponse> _send({
    required String method,
    required String path,
    Map<String, Object?>? body,
    String? accessToken,
  }) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (accessToken != null && accessToken.isNotEmpty)
        'Authorization': 'Bearer $accessToken',
    };
    final request = ApiHttpRequest(
      method: method,
      path: path,
      headers: headers,
      body: body,
    );
    final handler = _httpHandler;
    if (handler != null) {
      return handler(request);
    }
    final client = HttpClient();
    try {
      final uri = Uri.parse('$_baseUrl$path');
      final httpRequest = await client.openUrl(method, uri);
      headers.forEach(httpRequest.headers.set);
      if (body != null) {
        httpRequest.add(utf8.encode(jsonEncode(body)));
      }
      final httpResponse = await httpRequest.close();
      final text = await utf8.decoder.bind(httpResponse).join();
      var decodedBody = <String, Object?>{};
      if (text.trim().isNotEmpty) {
        final parsed = jsonDecode(text);
        if (parsed is Map) {
          decodedBody = Map<String, Object?>.from(parsed);
        }
      }
      return ApiHttpResponse(
        statusCode: httpResponse.statusCode,
        body: decodedBody,
      );
    } on SocketException {
      return const ApiHttpResponse(
        statusCode: 503,
        body: <String, Object?>{
          'error': <String, Object?>{
            'code': 'SERVICE_UNAVAILABLE',
            'message': 'No pudimos completar la solicitud.',
          },
        },
      );
    } finally {
      client.close(force: true);
    }
  }
}

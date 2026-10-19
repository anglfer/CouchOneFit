import '../../../shared/services/api_client.dart';
import '../models/session_models.dart';
import 'session_storage.dart';

class AuthService {
  AuthService({
    required ApiClient apiClient,
    required SessionStorage sessionStorage,
  })  : _apiClient = apiClient,
        _sessionStorage = sessionStorage;

  final ApiClient _apiClient;
  final SessionStorage _sessionStorage;

  Future<ClientAccount> login({
    required String identifier,
    required String password,
  }) async {
    final trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier.isEmpty || password.isEmpty) {
      throw const AuthApiException(
        statusCode: 400,
        code: 'INVALID_LOGIN',
        message: 'Revisa los datos de acceso.',
      );
    }

    final payload = await _apiClient.postJson(
      '/api/auth/client/login',
      body: <String, Object?>{
        'identifier': trimmedIdentifier,
        'password': password,
      },
    );

    final rawAccount = payload['account'];
    final rawSession = payload['session'];
    if (rawAccount is! Map || rawSession is! Map) {
      await _sessionStorage.clearSession();
      throw const AuthApiException(
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'No pudimos completar la solicitud.',
      );
    }

    final account =
        ClientAccount.fromJson(Map<String, Object?>.from(rawAccount));
    if (account.role != 'client' ||
        account.status != 'active' ||
        account.clientId.isEmpty) {
      await _sessionStorage.clearSession();
      throw const AuthApiException(
        statusCode: 403,
        code: 'ROLE_FORBIDDEN',
        message: 'Tu cuenta no tiene acceso a esta área.',
      );
    }

    final session =
        StoredSession.fromJson(Map<String, Object?>.from(rawSession));
    await _sessionStorage.saveSession(session);
    return account;
  }

  Future<ClientAccount?> restoreSession() async {
    final stored = await _sessionStorage.readSession();
    if (stored == null) return null;

    final payload = await _apiClient.getJson(
      '/api/auth/session',
      authenticated: true,
    );
    final rawAccount = payload['account'];
    if (rawAccount is! Map) {
      await _sessionStorage.clearSession();
      throw const AuthApiException(
        statusCode: 401,
        code: 'SESSION_REQUIRED',
        message: 'Tu sesión venció. Inicia sesión de nuevo.',
      );
    }
    final account =
        ClientAccount.fromJson(Map<String, Object?>.from(rawAccount));
    if (account.role != 'client' ||
        account.status != 'active' ||
        account.clientId.isEmpty) {
      await _sessionStorage.clearSession();
      throw const AuthApiException(
        statusCode: 403,
        code: 'ROLE_FORBIDDEN',
        message: 'Tu cuenta no tiene acceso a esta área.',
      );
    }
    return account;
  }

  Future<void> logout() async {
    await _apiClient.logoutSession();
  }
}


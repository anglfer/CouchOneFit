import '../../../shared/services/api_client.dart';
import '../../auth/models/session_models.dart';
import '../models/client_profile.dart';

class ClientProfileService {
  ClientProfileService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<ClientProfile> fetchProfile() async {
    final payload = await _apiClient.getJson(
      '/api/me/record',
      authenticated: true,
    );
    final rawProfile = payload['record'];
    if (rawProfile is! Map || rawProfile['id'] is! String || rawProfile['fullName'] is! String) {
      throw const AuthApiException(
        statusCode: 503,
        code: 'INVALID_RESPONSE',
        message: 'No pudimos consultar tu expediente. Inténtalo de nuevo.',
      );
    }
    return ClientProfile.fromJson(Map<String, Object?>.from(rawProfile));
  }
}


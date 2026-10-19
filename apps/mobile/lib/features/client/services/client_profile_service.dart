import '../../../shared/services/api_client.dart';
import '../../auth/models/session_models.dart';
import '../models/client_profile.dart';

class ClientProfileService {
  ClientProfileService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<ClientProfile> fetchProfile() async {
    final payload = await _apiClient.getJson(
      '/api/client/profile',
      authenticated: true,
    );
    final rawProfile = payload['profile'];
    if (rawProfile is! Map) {
      throw const AuthApiException(
        statusCode: 401,
        code: 'SESSION_REQUIRED',
        message: 'Tu sesión venció. Inicia sesión de nuevo.',
      );
    }
    return ClientProfile.fromJson(Map<String, Object?>.from(rawProfile));
  }
}


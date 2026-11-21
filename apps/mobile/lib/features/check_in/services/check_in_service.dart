import '../../../shared/services/api_client.dart';
import '../../training/models/training.dart';
import '../models/check_in.dart';

/// Daily check-in and shared progress. Nothing is cached on the phone: a
/// revoked category disappears on the next read (DEC-009).
class CheckInService {
  CheckInService({required this.apiClient});
  final ApiClient apiClient;

  Future<CheckInContext> context({String? date}) async =>
      CheckInContext(await apiClient.getJson(
          date == null
              ? '/api/me/check-ins/context'
              : '/api/me/check-ins/context?date=${Uri.encodeQueryComponent(date)}',
          authenticated: true));

  /// Same key and payload on a retry returns the original result, never a duplicate.
  Future<CheckIn> save(Map<String, Object?> body, String key) async {
    final raw = await apiClient.requestJson('POST', '/api/me/check-ins',
        body: body, idempotencyKey: key, authenticated: true);
    return CheckIn(trainingObject(raw['checkIn']));
  }

  Future<List<CheckIn>> history() async => trainingList(
      (await apiClient.getJson('/api/me/check-ins',
          authenticated: true))['checkIns'],
      CheckIn.new);

  Future<SharedProgress> progress() async => SharedProgress(
      await apiClient.getJson('/api/me/progress', authenticated: true));
}

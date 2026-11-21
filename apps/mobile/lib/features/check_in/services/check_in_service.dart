import 'dart:convert';
import 'package:flutter/services.dart';
import '../../../shared/services/api_client.dart';
import '../../training/models/training.dart';
import '../../training/services/training_service.dart';
import '../models/check_in.dart';

class CachedCheckIns {
  const CachedCheckIns({
    required this.clientId,
    required this.checkIns,
    required this.updatedAt,
  });

  final String clientId;
  final List<CheckIn> checkIns;
  final DateTime updatedAt;
}

/// Encrypted native cache for the client's own check-ins and body weight (RNF24).
/// Shared progress (/api/me/progress) is never cached (DEC-009).
class CheckInCache {
  CheckInCache({MethodChannel? channel, DateTime Function()? now})
      : _channel = channel ?? const MethodChannel('couchonefit/secure_session'),
        _now = now ?? DateTime.now;

  final MethodChannel _channel;
  final DateTime Function() _now;
  static const _key = 'cof_client_checkin_cache';
  String? _memory;

  Future<void> clear() async {
    _memory = null;
    try {
      await _channel.invokeMethod<void>('delete', {'key': _key});
    } on MissingPluginException {
      /* No plaintext fallback. */
    } on PlatformException {
      /* Native handler clears unreadable data. */
    }
  }

  Future<void> save(
    String clientId,
    List<Map<String, Object?>> checkInsJson,
  ) async {
    final value = jsonEncode({
      'clientId': clientId,
      'checkIns': checkInsJson,
      'updatedAt': _now().toUtc().toIso8601String(),
    });
    _memory = value;
    try {
      await _channel.invokeMethod<void>('write', {'key': _key, 'value': value});
    } on MissingPluginException {
      /* Memory only on unsupported platforms. */
    } on PlatformException {
      /* Memory only when native storage fails. */
    }
  }

  Future<CachedCheckIns?> read({String? clientId}) async {
    try {
      String? raw;
      try {
        raw = await _channel.invokeMethod<String>('read', {'key': _key});
      } on MissingPluginException {
        raw = _memory;
      } on PlatformException {
        raw = _memory;
      }
      if (raw == null) return null;
      final json = trainingObject(jsonDecode(raw));
      final storedClientId = trainingText(json['clientId']);
      final at = DateTime.parse(trainingText(json['updatedAt']));
      if (_now().difference(at).inDays >= 30 ||
          at.isAfter(_now()) ||
          (clientId != null && storedClientId != clientId)) {
        await clear();
        return null;
      }
      final list = trainingList(json['checkIns'], CheckIn.new);
      return CachedCheckIns(
        clientId: storedClientId,
        checkIns: list,
        updatedAt: at,
      );
    } catch (_) {
      await clear();
      return null;
    }
  }
}

/// Daily check-in and shared progress. Shared progress is never cached on the
/// phone: a revoked category disappears on the next read (DEC-009).
class CheckInService {
  CheckInService({required this.apiClient, CheckInCache? cache})
      : cache = cache ?? CheckInCache();
  final ApiClient apiClient;
  final CheckInCache cache;

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

  Future<({List<CheckIn> checkIns, DateTime? cachedAt})> historyWithCache({
    String? clientId,
  }) async {
    try {
      final raw =
          await apiClient.getJson('/api/me/check-ins', authenticated: true);
      final rawList = raw['checkIns'];
      final list = trainingList(rawList, CheckIn.new);
      final encoded = [
        for (final item in rawList as List) trainingObject(item),
      ];
      await cache.save(clientId ?? 'current', encoded);
      return (checkIns: list, cachedAt: null);
    } catch (error) {
      if (TrainingService.denied(error)) {
        await cache.clear();
      }
      final cached = TrainingService.disconnected(error)
          ? await cache.read(clientId: clientId)
          : null;
      if (cached != null) {
        return (checkIns: cached.checkIns, cachedAt: cached.updatedAt);
      }
      rethrow;
    }
  }

  Future<SharedProgress> progress() async => SharedProgress(
      await apiClient.getJson('/api/me/progress', authenticated: true));
}

import 'dart:convert';
import 'dart:math';
import 'package:flutter/services.dart';
import '../../auth/models/session_models.dart';
import '../../client/models/client_profile.dart';
import '../../../shared/services/api_client.dart';
import '../models/training.dart';

String trainingId() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final s = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${s.substring(0, 8)}-${s.substring(8, 12)}-${s.substring(12, 16)}-${s.substring(16, 20)}-${s.substring(20)}';
}

class CachedTraining {
  CachedTraining(this.profile, this.context, this.updatedAt);
  final ClientProfile profile;
  final TrainingContext context;
  final DateTime updatedAt;
}

class TrainingCache {
  TrainingCache({MethodChannel? channel, DateTime Function()? now})
      : _channel = channel ?? const MethodChannel('couchonefit/secure_session'),
        _now = now ?? DateTime.now;
  final MethodChannel _channel;
  final DateTime Function() _now;
  static const _key = 'cof_client_training_cache';
  String? _memory;
  Future<void> clear() async {
    _memory = null;
    try {
      await _channel.invokeMethod<void>('delete', {'key': _key});
    } on MissingPluginException {
      /* No plaintext fallback. */
    } on PlatformException {/* Native handler clears unreadable data. */}
  }

  Future<void> save(ClientProfile profile, TrainingContext context) async {
    if (profile.id != context.clientId) {
      throw const FormatException('Cuenta distinta');
    }
    final value = jsonEncode({
      'profile': profile.toJson(),
      'context': context.json,
      'updatedAt': _now().toUtc().toIso8601String()
    });
    _memory = value;
    try {
      await _channel.invokeMethod<void>('write', {'key': _key, 'value': value});
    } on MissingPluginException {
      /* Memory only on unsupported platforms. */
    } on PlatformException {/* Memory only when native storage fails. */}
  }

  Future<CachedTraining?> read({String? clientId}) async {
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
      final at = DateTime.parse(trainingText(json['updatedAt']));
      final profile = ClientProfile.fromJson(trainingObject(json['profile']));
      final context = TrainingContext(trainingObject(json['context']));
      if (_now().difference(at).inDays >= 30 ||
          at.isAfter(_now()) ||
          context.clientId != profile.id ||
          (clientId != null && profile.id != clientId)) {
        await clear();
        return null;
      }
      return CachedTraining(profile, context, at);
    } catch (_) {
      await clear();
      return null;
    }
  }
}

class TrainingService {
  TrainingService({required ApiClient apiClient, TrainingCache? cache})
      : _api = apiClient,
        cache = cache ?? TrainingCache();
  final ApiClient _api;
  final TrainingCache cache;
  Future<TrainingContext> context({String? date}) async {
    final raw = await _api.getJson(
        date == null
            ? '/api/me/training-plan'
            : '/api/me/training-sessions/context?date=${Uri.encodeQueryComponent(date)}',
        authenticated: true);
    return TrainingContext(raw);
  }

  Future<TrainingHistory> history({int offset = 0}) async => TrainingHistory(
      await _api.getJson('/api/me/training-history?offset=$offset',
          authenticated: true));

  Future<TrainingSession> save(Map<String, Object?> body, String key) async {
    final raw = await _api.requestJson('POST', '/api/me/training-sessions',
        body: body, idempotencyKey: key, authenticated: true);
    return TrainingSession(trainingObject(raw['session']));
  }

  static bool disconnected(Object error) =>
      error is AuthApiException && error.code == 'SERVICE_UNAVAILABLE';
  static bool denied(Object error) =>
      error is AuthApiException &&
      (error.statusCode == 401 || error.statusCode == 403);
}

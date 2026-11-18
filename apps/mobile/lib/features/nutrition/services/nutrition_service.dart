import 'dart:convert';
import 'package:flutter/services.dart';
import '../../../shared/services/api_client.dart';
import '../../auth/models/session_models.dart';
import '../models/nutrition_plan.dart';

class CachedNutrition {
  const CachedNutrition({
    required this.clientId,
    required this.plan,
    required this.updatedAt,
  });

  final String clientId;
  final NutritionPlan? plan;
  final DateTime updatedAt;
}

class NutritionCache {
  NutritionCache({MethodChannel? channel, DateTime Function()? now})
      : _channel = channel ?? const MethodChannel('couchonefit/secure_session'),
        _now = now ?? DateTime.now;

  final MethodChannel _channel;
  final DateTime Function() _now;
  static const _key = 'cof_client_nutrition_cache';
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

  Future<void> save(String clientId, Map<String, dynamic>? planJson) async {
    final value = jsonEncode({
      'clientId': clientId,
      'plan': planJson,
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

  Future<CachedNutrition?> read({required String clientId}) async {
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
      final json = nutritionObject(jsonDecode(raw));
      final storedClientId = nutritionText(json['clientId']);
      final at = DateTime.parse(nutritionText(json['updatedAt']));
      if (_now().difference(at).inDays >= 30 ||
          at.isAfter(_now()) ||
          storedClientId != clientId) {
        await clear();
        return null;
      }
      final rawPlan = json['plan'];
      final plan = rawPlan == null
          ? null
          : NutritionPlan.fromJson(nutritionObject(rawPlan));
      return CachedNutrition(
          clientId: storedClientId, plan: plan, updatedAt: at);
    } catch (_) {
      await clear();
      return null;
    }
  }
}

class NutritionService {
  NutritionService({required ApiClient apiClient, NutritionCache? cache})
      : _api = apiClient,
        cache = cache ?? NutritionCache();

  final ApiClient _api;
  final NutritionCache cache;

  Future<({NutritionPlan? plan, Map<String, dynamic>? rawPlan})>
      fetchActivePlan() async {
    final raw =
        await _api.getJson('/api/me/nutrition-plan', authenticated: true);
    final rawPlan = raw['plan'];
    if (rawPlan == null) return (plan: null, rawPlan: null);
    final map = nutritionObject(rawPlan);
    return (plan: NutritionPlan.fromJson(map), rawPlan: map);
  }

  static bool disconnected(Object error) =>
      error is AuthApiException && error.code == 'SERVICE_UNAVAILABLE';

  static bool denied(Object error) =>
      error is AuthApiException &&
      (error.statusCode == 401 || error.statusCode == 403);
}

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../models/app_settings.dart';

/// Holds [AppSettings] and keeps them in the native storage channel the app
/// already uses (no extra dependency). Falls back to memory in tests.
class SettingsController extends ValueNotifier<AppSettings> {
  SettingsController({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('couchonefit/secure_session'),
        super(const AppSettings());
  final MethodChannel _channel;
  static const _key = 'cof_app_settings';

  Future<void> load() async {
    try {
      final raw = await _channel.invokeMethod<String>('read', {'key': _key});
      if (raw != null) value = AppSettings.fromJson(jsonDecode(raw));
    } on MissingPluginException {
      /* Defaults on unsupported platforms. */
    } on PlatformException {
      /* Defaults when native storage fails. */
    } on FormatException {
      /* Corrupt value: keep defaults. */
    }
  }

  Future<void> update(AppSettings next) async {
    value = next;
    try {
      await _channel.invokeMethod<void>(
          'write', {'key': _key, 'value': jsonEncode(next.toJson())});
    } on MissingPluginException {
      /* Memory only. */
    } on PlatformException {
      /* Memory only. */
    }
  }
}

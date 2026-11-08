import 'package:flutter/material.dart';

/// Device preferences of the client app. Nothing here leaves the phone.
class AppSettings {
  const AppSettings(
      {this.themeMode = ThemeMode.system,
      this.restTimer = true,
      this.defaultRestSeconds = 90,
      this.loadStep = 2.5,
      this.haptics = true});
  final ThemeMode themeMode;
  final bool restTimer, haptics;

  /// Used when the professional did not prescribe a rest.
  final int defaultRestSeconds;

  /// Kg added or removed by the − / + buttons in the log.
  final double loadStep;

  static const restOptions = [60, 90, 120, 180];
  static const stepOptions = [1.0, 1.25, 2.5, 5.0];

  AppSettings copyWith(
          {ThemeMode? themeMode,
          bool? restTimer,
          int? defaultRestSeconds,
          double? loadStep,
          bool? haptics}) =>
      AppSettings(
          themeMode: themeMode ?? this.themeMode,
          restTimer: restTimer ?? this.restTimer,
          defaultRestSeconds: defaultRestSeconds ?? this.defaultRestSeconds,
          loadStep: loadStep ?? this.loadStep,
          haptics: haptics ?? this.haptics);

  Map<String, Object?> toJson() => {
        'themeMode': themeMode.name,
        'restTimer': restTimer,
        'defaultRestSeconds': defaultRestSeconds,
        'loadStep': loadStep,
        'haptics': haptics
      };

  /// Unknown or out-of-range values fall back to the defaults.
  factory AppSettings.fromJson(Object? json) {
    const d = AppSettings();
    if (json is! Map) return d;
    final theme = ThemeMode.values.where((m) => m.name == json['themeMode']);
    final rest = json['defaultRestSeconds'];
    final step = json['loadStep'];
    return AppSettings(
        themeMode: theme.isEmpty ? d.themeMode : theme.first,
        restTimer:
            json['restTimer'] is bool ? json['restTimer'] as bool : d.restTimer,
        defaultRestSeconds:
            restOptions.contains(rest) ? rest as int : d.defaultRestSeconds,
        loadStep: step is num && stepOptions.contains(step.toDouble())
            ? step.toDouble()
            : d.loadStep,
        haptics: json['haptics'] is bool ? json['haptics'] as bool : d.haptics);
  }
}

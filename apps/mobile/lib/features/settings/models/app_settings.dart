import 'package:flutter/material.dart';

/// Device preferences of the client app. Nothing here leaves the phone.
class AppSettings {
  const AppSettings(
      {this.themeMode = ThemeMode.system,
      this.restTimer = true,
      this.defaultRestSeconds = 90,
      this.loadStep = 2.5,
      this.haptics = true,
      this.workoutNotification = true,
      this.mealReminders = true,
      this.mealReminderLeadMinutes = 15});
  final ThemeMode themeMode;
  final bool restTimer, haptics, workoutNotification, mealReminders;

  /// Used when the professional did not prescribe a rest.
  final int defaultRestSeconds;

  /// Kg added or removed by the − / + buttons in the log.
  final double loadStep;

  /// Minutes before each scheduled meal to send a reminder.
  final int mealReminderLeadMinutes;

  static const restOptions = [60, 90, 120, 180];
  static const stepOptions = [1.0, 1.25, 2.5, 5.0];
  static const mealLeadOptions = [0, 10, 15, 30];

  AppSettings copyWith(
          {ThemeMode? themeMode,
          bool? restTimer,
          int? defaultRestSeconds,
          double? loadStep,
          bool? haptics,
          bool? workoutNotification,
          bool? mealReminders,
          int? mealReminderLeadMinutes}) =>
      AppSettings(
          themeMode: themeMode ?? this.themeMode,
          restTimer: restTimer ?? this.restTimer,
          defaultRestSeconds: defaultRestSeconds ?? this.defaultRestSeconds,
          loadStep: loadStep ?? this.loadStep,
          haptics: haptics ?? this.haptics,
          workoutNotification: workoutNotification ?? this.workoutNotification,
          mealReminders: mealReminders ?? this.mealReminders,
          mealReminderLeadMinutes:
              mealReminderLeadMinutes ?? this.mealReminderLeadMinutes);

  Map<String, Object?> toJson() => {
        'themeMode': themeMode.name,
        'restTimer': restTimer,
        'defaultRestSeconds': defaultRestSeconds,
        'loadStep': loadStep,
        'haptics': haptics,
        'workoutNotification': workoutNotification,
        'mealReminders': mealReminders,
        'mealReminderLeadMinutes': mealReminderLeadMinutes
      };

  /// Unknown or out-of-range values fall back to the defaults.
  factory AppSettings.fromJson(Object? json) {
    const d = AppSettings();
    if (json is! Map) return d;
    final theme = ThemeMode.values.where((m) => m.name == json['themeMode']);
    final rest = json['defaultRestSeconds'];
    final step = json['loadStep'];
    final lead = json['mealReminderLeadMinutes'];
    return AppSettings(
        themeMode: theme.isEmpty ? d.themeMode : theme.first,
        restTimer:
            json['restTimer'] is bool ? json['restTimer'] as bool : d.restTimer,
        defaultRestSeconds:
            restOptions.contains(rest) ? rest as int : d.defaultRestSeconds,
        loadStep: step is num && stepOptions.contains(step.toDouble())
            ? step.toDouble()
            : d.loadStep,
        haptics: json['haptics'] is bool ? json['haptics'] as bool : d.haptics,
        workoutNotification: json['workoutNotification'] is bool
            ? json['workoutNotification'] as bool
            : d.workoutNotification,
        mealReminders: json['mealReminders'] is bool
            ? json['mealReminders'] as bool
            : d.mealReminders,
        mealReminderLeadMinutes: mealLeadOptions.contains(lead)
            ? lead as int
            : d.mealReminderLeadMinutes);
  }
}

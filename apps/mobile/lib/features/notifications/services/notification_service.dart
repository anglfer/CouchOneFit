import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../../nutrition/models/nutrition_plan.dart';
import '../../settings/models/app_settings.dart';
import '../models/notification_models.dart';

/// Bridges live workout controls and daily meal reminders with the native
/// notification system. Falls back silently on platforms/tests without channel.
class NotificationService {
  NotificationService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('couchonefit/notifications') {
    _channel.setMethodCallHandler(_handleIncoming);
  }

  final MethodChannel _channel;
  final _workoutActions =
      StreamController<WorkoutNotificationAction>.broadcast();
  final _navigationTargets = StreamController<String>.broadcast();
  final _scheduledMeals = ValueNotifier<List<ScheduledMealReminder>>(const []);
  final _skippedMealsCount = ValueNotifier<int>(0);

  String? _lastWorkoutSignature;
  String? _lastMealSignature;
  bool _permissionPrompted = false;
  bool _disposed = false;

  Stream<WorkoutNotificationAction> get workoutActions =>
      _workoutActions.stream;
  Stream<String> get navigationTargets => _navigationTargets.stream;
  ValueListenable<List<ScheduledMealReminder>> get scheduledMeals =>
      _scheduledMeals;
  ValueListenable<int> get skippedMealsCount => _skippedMealsCount;

  Future<dynamic> _handleIncoming(MethodCall call) async {
    if (_disposed) return null;
    final args = call.arguments;
    if (call.method == 'onWorkoutAction' && args is Map) {
      final action =
          WorkoutNotificationAction.fromWire(args['action'] as String?);
      if (action != null) _workoutActions.add(action);
    } else if (call.method == 'onNavigate' && args is Map) {
      final target = args['target'] as String?;
      if (target != null && target.isNotEmpty) {
        _navigationTargets.add(target);
      }
    }
    return null;
  }

  Future<bool> requestPermission({bool force = false}) async {
    if (_permissionPrompted && !force) return areEnabled();
    _permissionPrompted = true;
    try {
      final granted = await _channel.invokeMethod<bool>('requestPermission');
      return granted ?? true;
    } on MissingPluginException {
      return true;
    } on PlatformException {
      return false;
    }
  }

  Future<bool> areEnabled() async {
    try {
      final enabled = await _channel.invokeMethod<bool>('areEnabled');
      return enabled ?? true;
    } on MissingPluginException {
      return true;
    } on PlatformException {
      return false;
    }
  }

  Future<void> openSettings() async {
    try {
      await _channel.invokeMethod<void>('openSettings');
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Ignore OS errors. */
    }
  }

  /// Android 14+ denies exact alarms by default; meal reminders can then
  /// arrive up to an hour late.
  Future<bool> canScheduleExactAlarms() async {
    try {
      return await _channel.invokeMethod<bool>('canScheduleExactAlarms') ??
          true;
    } on MissingPluginException {
      return true;
    } on PlatformException {
      return true;
    }
  }

  Future<void> openExactAlarmSettings() async {
    try {
      await _channel.invokeMethod<void>('openExactAlarmSettings');
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Ignore OS errors. */
    }
  }

  Future<void> syncWorkout(
    WorkoutNotificationState state, {
    bool force = false,
  }) async {
    if (_disposed) return;
    final sig = state.signature;
    if (!force && _lastWorkoutSignature == sig) return;
    _lastWorkoutSignature = sig;
    try {
      await _channel.invokeMethod<void>(
        'showWorkoutNotification',
        state.toChannelMap(),
      );
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Never interrupt the workout UI. */
    }
  }

  Future<void> clearWorkout() async {
    _lastWorkoutSignature = null;
    try {
      await _channel.invokeMethod<void>('cancelWorkoutNotification');
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Ignore OS errors. */
    }
  }

  Future<void> syncMealReminders(
    NutritionPlan? plan,
    AppSettings settings,
  ) async {
    if (_disposed) return;
    final reminders = buildMealReminders(
      plan,
      leadMinutes: settings.mealReminderLeadMinutes,
    );
    _scheduledMeals.value = reminders;
    _skippedMealsCount.value =
        plan == null ? 0 : (plan.meals.length - reminders.length).clamp(0, 12);

    final sig = [
      settings.mealReminders,
      settings.mealReminderLeadMinutes,
      for (final r in reminders)
        '${r.id}:${r.name}:${r.scheduleLabel}:${r.triggerTime.formatted24h}:${r.preview}',
    ].join('|');
    if (_lastMealSignature == sig) return;
    _lastMealSignature = sig;

    try {
      if (!settings.mealReminders || reminders.isEmpty) {
        await _channel.invokeMethod<void>('cancelMealReminders');
      } else {
        await _channel.invokeMethod<void>('scheduleMealReminders', {
          'enabled': true,
          'leadMinutes': settings.mealReminderLeadMinutes,
          'meals': [for (final r in reminders) r.toChannelMap()],
        });
      }
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Ignore OS errors. */
    }
  }

  Future<void> cancelMealReminders() async {
    _lastMealSignature = null;
    _scheduledMeals.value = const [];
    _skippedMealsCount.value = 0;
    try {
      await _channel.invokeMethod<void>('cancelMealReminders');
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Ignore OS errors. */
    }
  }

  Future<void> cancelAll() async {
    _lastWorkoutSignature = null;
    _lastMealSignature = null;
    _scheduledMeals.value = const [];
    _skippedMealsCount.value = 0;
    try {
      await _channel.invokeMethod<void>('cancelAll');
    } on MissingPluginException {
      /* Unsupported platform. */
    } on PlatformException {
      /* Ignore OS errors. */
    }
  }

  Future<String?> consumePendingLaunchTarget() async {
    try {
      return await _channel.invokeMethod<String>('consumePendingLaunchTarget');
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _channel.setMethodCallHandler(null);
    _workoutActions.close();
    _navigationTargets.close();
    _scheduledMeals.dispose();
    _skippedMealsCount.dispose();
  }
}

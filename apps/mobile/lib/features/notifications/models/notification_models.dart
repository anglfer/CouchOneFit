import '../../nutrition/models/nutrition_plan.dart';

/// Clock time in local 24-hour format used for meal reminder alarms.
class MealTimeOfDay {
  const MealTimeOfDay(this.hour, this.minute);

  final int hour;
  final int minute;

  int get totalMinutes => hour * 60 + minute;

  /// Subtracts [minutes] wrapping cleanly across midnight.
  MealTimeOfDay subtractMinutes(int minutes) {
    final shifted = ((totalMinutes - minutes) % 1440 + 1440) % 1440;
    return MealTimeOfDay(shifted ~/ 60, shifted % 60);
  }

  String get formatted24h =>
      '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';

  @override
  bool operator ==(Object other) =>
      other is MealTimeOfDay && other.hour == hour && other.minute == minute;

  @override
  int get hashCode => Object.hash(hour, minute);
}

final _colonTimePattern = RegExp(
  r'(?<!\d)(\d{1,2})\s*:\s*(\d{2})(?:\s*(a\.?\s*m\.?|p\.?\s*m\.?))?(?!\d)',
  caseSensitive: false,
);

final _meridiemOnlyPattern = RegExp(
  r'(?<!\d)(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)(?!\w)',
  caseSensitive: false,
);

final _relativeTimeHint = RegExp(
  r'\b(min(?:utos?)?\s*(?:pre|antes|post|despu[eé]s)|despu[eé]s\s+de|antes\s+de|al\s+despertar|post\s*entreno|pre\s*entreno)\b',
  caseSensitive: false,
);

MealTimeOfDay? _normalizeClock(int rawHour, int minute, String? meridiem) {
  if (minute < 0 || minute > 59) return null;
  if (meridiem == null || meridiem.isEmpty) {
    if (rawHour < 0 || rawHour > 23) return null;
    return MealTimeOfDay(rawHour, minute);
  }
  final lower = meridiem.toLowerCase();
  final isPm = lower.startsWith('p');
  if (rawHour < 1 || rawHour > 12) return null;
  var hour = rawHour % 12;
  if (isPm) hour += 12;
  return MealTimeOfDay(hour, minute);
}

/// Parses wall-clock meal times like "08:00", "8:00 AM", "1:30 p.m.",
/// "08:00 - 09:00", or "14:00 hrs". Ignores relative offsets like "60 min pre".
MealTimeOfDay? parseMealScheduleTime(String? raw) {
  if (raw == null) return null;
  final text = raw.trim();
  if (text.isEmpty) return null;

  final colonMatch = _colonTimePattern.firstMatch(text);
  if (colonMatch != null) {
    final hour = int.tryParse(colonMatch.group(1)!);
    final minute = int.tryParse(colonMatch.group(2)!);
    if (hour == null || minute == null) return null;
    return _normalizeClock(hour, minute, colonMatch.group(3));
  }

  if (_relativeTimeHint.hasMatch(text)) return null;

  final meridiemMatch = _meridiemOnlyPattern.firstMatch(text);
  if (meridiemMatch != null) {
    final hour = int.tryParse(meridiemMatch.group(1)!);
    if (hour == null) return null;
    return _normalizeClock(hour, 0, meridiemMatch.group(2));
  }

  return null;
}

/// Single daily meal reminder derived from a [NutritionMeal] with a clock time.
class ScheduledMealReminder {
  const ScheduledMealReminder({
    required this.id,
    required this.name,
    required this.scheduleLabel,
    required this.mealTime,
    required this.triggerTime,
    required this.preview,
  });

  final String id;
  final String name;
  final String scheduleLabel;
  final MealTimeOfDay mealTime;
  final MealTimeOfDay triggerTime;
  final String preview;

  Map<String, Object?> toChannelMap() => {
        'id': id,
        'name': name,
        'scheduleLabel': scheduleLabel,
        'hour': triggerTime.hour,
        'minute': triggerTime.minute,
        'preview': preview,
      };
}

String _mealPreview(NutritionMeal meal) {
  final itemNames = [for (final item in meal.items.take(2)) item.name];
  final extra = meal.items.length - itemNames.length;
  final itemsPart = itemNames.isEmpty
      ? ''
      : extra > 0
          ? '${itemNames.join(', ')} y $extra más'
          : itemNames.join(', ');
  final kcal = meal.hasItemMacros
      ? '${meal.computedCalories} kcal'
      : meal.targetCalories != null
          ? '${meal.targetCalories!.round()} kcal'
          : null;
  if (itemsPart.isNotEmpty && kcal != null) return '$itemsPart · $kcal';
  if (itemsPart.isNotEmpty) return itemsPart;
  if (kcal != null) return kcal;
  return 'Consulta tu plan nutricional en CouchOne Fit.';
}

/// Builds daily meal reminders for every meal with a valid clock schedule.
List<ScheduledMealReminder> buildMealReminders(
  NutritionPlan? plan, {
  required int leadMinutes,
}) {
  if (plan == null) return const [];
  final reminders = <ScheduledMealReminder>[];
  for (final meal in plan.meals.take(12)) {
    final parsed = parseMealScheduleTime(meal.scheduleTime);
    if (parsed == null) continue;
    reminders.add(
      ScheduledMealReminder(
        id: meal.id,
        name: meal.name,
        scheduleLabel: parsed.formatted24h,
        mealTime: parsed,
        triggerTime: parsed.subtractMinutes(leadMinutes),
        preview: _mealPreview(meal),
      ),
    );
  }
  return reminders;
}

/// Actions dispatched from the persistent workout notification buttons.
enum WorkoutNotificationAction {
  completeSet,
  restAdd15,
  restSub15,
  restSkip,
  restTogglePause,
  restStart,
  restFinished,
  openWorkout;

  static WorkoutNotificationAction? fromWire(String? raw) => switch (raw) {
        'complete_set' => WorkoutNotificationAction.completeSet,
        'rest_add_15' => WorkoutNotificationAction.restAdd15,
        'rest_sub_15' => WorkoutNotificationAction.restSub15,
        'rest_skip' => WorkoutNotificationAction.restSkip,
        'rest_toggle_pause' => WorkoutNotificationAction.restTogglePause,
        'rest_start' => WorkoutNotificationAction.restStart,
        'rest_finished' => WorkoutNotificationAction.restFinished,
        'open_workout' => WorkoutNotificationAction.openWorkout,
        _ => null,
      };
}

/// Snapshot synced to the native persistent workout notification.
class WorkoutNotificationState {
  const WorkoutNotificationState({
    required this.dayName,
    required this.startedAtMs,
    required this.completedSets,
    required this.totalSets,
    this.exerciseName,
    this.nextSetNumber,
    this.exerciseTotalSets,
    this.nextSetSummary,
    this.restActive = false,
    this.restPaused = false,
    this.restEndAtMs,
    this.restRemainingSec = 0,
    this.haptics = true,
  });

  final String dayName;
  final int startedAtMs;
  final int completedSets;
  final int totalSets;
  final String? exerciseName;
  final int? nextSetNumber;
  final int? exerciseTotalSets;
  final String? nextSetSummary;
  final bool restActive;
  final bool restPaused;
  final int? restEndAtMs;
  final int restRemainingSec;
  final bool haptics;

  /// Stable signature so unchanged ticks do not re-post the notification.
  String get signature => [
        dayName,
        startedAtMs,
        completedSets,
        totalSets,
        exerciseName ?? '',
        nextSetNumber ?? '',
        exerciseTotalSets ?? '',
        nextSetSummary ?? '',
        restActive,
        restPaused,
        restPaused ? restRemainingSec : (restEndAtMs ?? 0),
        haptics,
      ].join('|');

  Map<String, Object?> toChannelMap() => {
        'dayName': dayName,
        'startedAtMs': startedAtMs,
        'completedSets': completedSets,
        'totalSets': totalSets,
        'exerciseName': exerciseName,
        'nextSetNumber': nextSetNumber,
        'exerciseTotalSets': exerciseTotalSets,
        'nextSetSummary': nextSetSummary,
        'restActive': restActive,
        'restPaused': restPaused,
        'restEndAtMs': restEndAtMs,
        'restRemainingSec': restRemainingSec,
        'haptics': haptics,
      };
}

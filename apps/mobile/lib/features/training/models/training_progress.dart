import 'training.dart';

/// Spanish thousands separator: 307450 -> "307.450".
String trainingThousands(num value) => value
    .round()
    .toString()
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => '.');

String mondayOf(String date) => shiftDate(date, 1 - trainingDate(date).weekday);

double setsVolume(Iterable<SetResult> sets) =>
    sets.fold(0, (total, s) => total + s.reps * (s.loadKg ?? 0));

double sessionVolume(HistorySession s) =>
    s.exercises.fold(0, (total, e) => total + setsVolume(e.performed));

int sessionPerformed(HistorySession s) =>
    s.exercises.fold(0, (total, e) => total + e.performed.length);

/// "65 kg × 10 · RIR 2" (or "12 reps" for bodyweight).
String setLabel(SetResult s) => s.state == 'not_performed'
    ? 'No hecha'
    : [
        s.loadKg == null || s.loadKg == 0
            ? '${s.reps} reps'
            : '${trainingDecimal(s.loadKg!)} kg × ${s.reps}',
        if (s.rir != null) 'RIR ${s.rir}',
        if (s.rpe != null) 'RPE ${trainingDecimal(s.rpe!)}',
      ].join(' · ');

/// Compact "65×10" form used in the "last time" line.
String setShort(SetResult s) => s.state == 'not_performed'
    ? '—'
    : [
        s.loadKg == null || s.loadKg == 0
            ? '${s.reps} reps'
            : '${trainingDecimal(s.loadKg!)}×${s.reps}',
        if (s.rir != null) '(RIR ${s.rir})',
      ].join(' ');

class TrainingStats {
  factory TrainingStats(TrainingHistory history, String today) {
    // Streaks: user decision 04-nov-2026, overrides the UI-001 exclusion.
    final trained = history.sessions.where((s) => sessionPerformed(s) > 0);
    final weeks = trained.map((s) => mondayOf(s.localDate)).toSet();
    var week = mondayOf(today);
    // The current week only breaks the streak once it is over.
    if (!weeks.contains(week)) week = shiftDate(week, -7);
    var streak = 0;
    while (weeks.contains(week)) {
      streak++;
      week = shiftDate(week, -7);
    }
    return TrainingStats._(
        trained.length,
        trained
            .where((s) => s.localDate.startsWith(today.substring(0, 7)))
            .length,
        streak,
        trained.fold(0.0, (total, s) => total + sessionVolume(s)));
  }
  TrainingStats._(this.total, this.thisMonth, this.weekStreak, this.volume);
  final int total, thisMonth, weekStreak;
  final double volume;
}

class ExercisePoint {
  const ExercisePoint(this.date, this.top, this.exercise);
  final String date;
  final SetResult top;
  final HistoryExercise exercise;
}

/// Best set per session for one exercise, oldest first.
class ExerciseProgress {
  ExerciseProgress(this.key, this.name, this.bodyweight, this.points);
  final String key, name;
  final bool bodyweight;
  final List<ExercisePoint> points;

  /// Kg for loaded exercises, reps for bodyweight ones.
  double value(SetResult s) => bodyweight ? s.reps.toDouble() : s.loadKg ?? 0;
  List<double> get values => points.map((p) => value(p.top)).toList();
  double get best => values.reduce((a, b) => a > b ? a : b);

  /// Best Epley estimate per session (loaded sessions only), oldest first.
  List<double> get estimates {
    final out = <double>[];
    for (final p in points) {
      final v = bestEstimatedMax(p.exercise);
      if (v != null) out.add(v);
    }
    return out;
  }

  double get change => values.last - values.first;
  String format(double v) =>
      bodyweight ? '${v.round()} reps' : '${trainingDecimal(v)} kg';
}

SetResult? topSet(HistoryExercise e) {
  SetResult? top;
  for (final s in e.performed) {
    final load = s.loadKg ?? 0, best = top?.loadKg ?? 0;
    if (top == null ||
        (e.bodyweight
            ? s.reps > top.reps
            : load > best || (load == best && s.reps > top.reps))) {
      top = s;
    }
  }
  return top;
}

List<ExerciseProgress> exerciseProgress(TrainingHistory history) {
  final byKey = <String, ExerciseProgress>{};
  for (final session in history.sessions.reversed) {
    for (final e in session.exercises) {
      final top = topSet(e);
      if (top == null) continue;
      byKey
          .putIfAbsent(
              e.key, () => ExerciseProgress(e.key, e.name, e.bodyweight, []))
          .points
          .add(ExercisePoint(session.localDate, top, e));
    }
  }
  // Most trained first, then alphabetical.
  return byKey.values.toList()
    ..sort((a, b) => b.points.length != a.points.length
        ? b.points.length - a.points.length
        : a.name.compareTo(b.name));
}

/// Most recent earlier session where [key] had at least one performed set.
(String, HistoryExercise)? lastTime(
    TrainingHistory history, String key, String before) {
  for (final session in history.sessions) {
    if (session.localDate.compareTo(before) >= 0) continue;
    for (final e in session.exercises) {
      if (e.key == key && e.performed.isNotEmpty) return (session.localDate, e);
    }
  }
  return null;
}

/// Best kg (or reps for bodyweight) recorded before [before], if any.
double? bestBefore(
    TrainingHistory history, String key, bool bodyweight, String before) {
  double? best;
  for (final session in history.sessions) {
    if (session.localDate.compareTo(before) >= 0) continue;
    for (final e in session.exercises.where((e) => e.key == key)) {
      for (final s in e.performed) {
        final v = bodyweight ? s.reps.toDouble() : s.loadKg ?? 0;
        if (best == null || v > best) best = v;
      }
    }
  }
  return best;
}

// Catalog muscle (Spanish, see import-training-catalog.ts) -> display group.
const _muscleGroup = {
  'Pectoral mayor': 'Pecho',
  'Serrato anterior': 'Pecho',
  'Dorsal ancho': 'Espalda',
  'Espalda alta': 'Espalda',
  'Trapecio': 'Espalda',
  'Erectores espinales': 'Espalda',
  'Deltoides': 'Hombros',
  'Bíceps': 'Bíceps',
  'Antebrazos': 'Antebrazos',
  'Tríceps': 'Tríceps',
  'Recto abdominal': 'Abdomen',
  'Glúteo mayor': 'Glúteos',
  'Abductores': 'Glúteos',
  'Aductores': 'Aductores',
  'Cuádriceps': 'Cuádriceps',
  'Isquiotibiales': 'Isquiotibiales',
  'Gemelos': 'Pantorrillas',
};
const _bodyPartGroup = {
  'Pecho': 'Pecho',
  'Espalda': 'Espalda',
  'Hombros': 'Hombros',
  'Zona media': 'Abdomen',
  'Antebrazos': 'Antebrazos',
  'Pantorrillas': 'Pantorrillas',
};

/// Display groups of an exercise; body part only when muscles are unknown.
List<String> muscleGroups(List<String> muscles, String? bodyPart) {
  final groups = <String>{
    for (final m in muscles)
      if (_muscleGroup[m] != null) _muscleGroup[m]!
  };
  if (groups.isEmpty && _bodyPartGroup[bodyPart] != null) {
    groups.add(_bodyPartGroup[bodyPart]!);
  }
  return groups.toList();
}

/// Groups worked in a day, most sets first.
List<String> dayGroups(TrainingDay day) {
  final sets = <String, int>{};
  for (final e in day.exercises) {
    for (final g in muscleGroups(e.muscles, e.bodyPart)) {
      sets[g] = (sets[g] ?? 0) + e.sets.length;
    }
  }
  return (sets.keys.toList()..sort((a, b) => sets[b]! - sets[a]!));
}

/// Performed sets per group since [since] (inclusive; null = all), most first.
List<MapEntry<String, int>> setsByGroup(TrainingHistory h, {String? since}) {
  final sets = <String, int>{};
  for (final s in h.sessions) {
    if (since != null && s.localDate.compareTo(since) < 0) continue;
    for (final e in s.exercises) {
      for (final g in muscleGroups(e.muscles, e.bodyPart)) {
        sets[g] = (sets[g] ?? 0) + e.performed.length;
      }
    }
  }
  return sets.entries.where((e) => e.value > 0).toList()
    ..sort((a, b) => b.value - a.value);
}

/// Estimated recovery of one muscle group. Orientative only: days since it
/// was last trained against 2–4 days depending on the sets done that day.
class GroupRecovery {
  GroupRecovery(this.group, this.lastDate, this.sets, this.daysAgo);
  final String group, lastDate;
  final int sets, daysAgo;
  int get neededDays => sets <= 6
      ? 2
      : sets <= 12
          ? 3
          : 4;
  double get ratio => (daysAgo / neededDays).clamp(0, 1).toDouble();
  String get status => ratio >= 1
      ? 'Recuperado'
      : ratio >= .5
          ? 'Recuperándose'
          : 'Cargado';
}

List<GroupRecovery> recovery(TrainingHistory h, String today) {
  final found = <String, GroupRecovery>{};
  for (final s in h.sessions) {
    final days =
        trainingDate(today).difference(trainingDate(s.localDate)).inDays;
    if (days < 0) continue;
    final perGroup = <String, int>{};
    for (final e in s.exercises) {
      for (final g in muscleGroups(e.muscles, e.bodyPart)) {
        perGroup[g] = (perGroup[g] ?? 0) + e.performed.length;
      }
    }
    perGroup.forEach((g, sets) {
      if (sets > 0 && !found.containsKey(g)) {
        found[g] = GroupRecovery(g, s.localDate, sets, days);
      }
    });
  }
  return found.values.toList()..sort((a, b) => a.ratio.compareTo(b.ratio));
}

/// Epley estimated one-rep max; null for bodyweight-only sets.
double? estimatedMax(SetResult s) =>
    s.loadKg == null || s.loadKg == 0 ? null : s.loadKg! * (1 + s.reps / 30);

double? bestEstimatedMax(HistoryExercise e) {
  double? best;
  for (final s in e.performed) {
    final v = estimatedMax(s);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}

/// Activity value per day: performed sets or volume (kg).
double activityValue(HistorySession? s, {required bool volume}) => s == null
    ? 0
    : volume
        ? sessionVolume(s)
        : sessionPerformed(s).toDouble();

/// Best Epley estimate for [key] in sessions before [before].
double? bestEstimateBefore(TrainingHistory history, String key, String before) {
  double? best;
  for (final session in history.sessions) {
    if (session.localDate.compareTo(before) >= 0) continue;
    for (final e in session.exercises.where((e) => e.key == key)) {
      final v = bestEstimatedMax(e);
      if (v != null && (best == null || v > best)) best = v;
    }
  }
  return best;
}

/// One-rep max for [kg] × [reps]: the load itself for a single, else Epley.
double oneRepMax(double kg, int reps) => reps <= 1 ? kg : kg * (1 + reps / 30);

/// Reps Epley predicts at [fraction] of the one-rep max.
int repsAtFraction(double fraction) =>
    fraction >= 1 ? 1 : (30 * (1 / fraction - 1)).round().clamp(1, 100);

/// Nearest multiple of [step] (plates), e.g. 0,5 kg.
double roundToStep(double kg, double step) =>
    double.parse(((kg / step).round() * step).toStringAsFixed(2));

enum LoadAdviceKind { increase, keep }

/// Double progression from last time: once every working set reached the top
/// of its prescribed range at the same load, add one load step.
class LoadAdvice {
  const LoadAdvice(
      this.kind, this.fromKg, this.toKg, this.lastReps, this.topReps);
  final LoadAdviceKind kind;
  final double fromKg, toKg;

  /// Reps of last time's performed working sets, in order.
  final List<int> lastReps;

  /// Highest rep target among the working sets.
  final int topReps;
}

/// Working sets: warm-ups and drop sets are light on purpose.
bool progressionSet(PrescribedSet s) => !s.warmup && s.kind != 'drop';

/// Null when the exercise is bodyweight, the professional fixed the working
/// loads, or last time has no loaded working set to build on.
LoadAdvice? loadAdvice(
    List<PrescribedSet> plan, List<SetResult?> last, double step) {
  final work = [
    for (var i = 0; i < plan.length; i++)
      if (progressionSet(plan[i])) i
  ];
  if (work.isEmpty || work.any((i) => plan[i].targetLoadKg != null)) {
    return null;
  }
  SetResult? at(int i) => i < last.length &&
          last[i]?.state == 'performed' &&
          (last[i]!.loadKg ?? 0) > 0
      ? last[i]
      : null;
  final done = work.where((i) => at(i) != null).toList();
  if (done.isEmpty) return null;
  final from = done.map((i) => at(i)!.loadKg!).reduce((a, b) => a > b ? a : b);
  final hitAll = done.length == work.length &&
      work.every((i) =>
          at(i)!.loadKg! >= from - .001 &&
          at(i)!.reps >= (plan[i].repsMax ?? plan[i].reps));
  final top = work
      .map((i) => plan[i].repsMax ?? plan[i].reps)
      .reduce((a, b) => a > b ? a : b);
  final to = hitAll
      ? double.parse((from + step).clamp(0, 1000).toStringAsFixed(1))
      : from;
  return LoadAdvice(hitAll ? LoadAdviceKind.increase : LoadAdviceKind.keep,
      from, to, [for (final i in done) at(i)!.reps], top);
}

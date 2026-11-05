Map<String, Object?> trainingObject(Object? value) {
  if (value is! Map<String, Object?>) {
    throw const FormatException('Objeto de entrenamiento inválido');
  }
  return value;
}

String trainingText(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Texto de entrenamiento inválido');
  }
  return value;
}

List<T> trainingList<T>(Object? value, T Function(Map<String, Object?>) parse) {
  if (value is! List) {
    throw const FormatException('Lista de entrenamiento inválida');
  }
  return value.map((e) => parse(trainingObject(e))).toList();
}

/// Optional list of non-empty strings (absent = empty).
List<String> trainingStrings(Object? value) =>
    value == null ? const [] : (value as List).map(trainingText).toList();

num? trainingOptional(Object? value, num min, num max, {num step = 1}) =>
    value == null ? null : trainingNumber(value, min, max, step: step);

/// Spanish decimal formatting: 12.5 -> "12,5", 60.0 -> "60".
String trainingCount(int n, String one, String many) =>
    '$n ${n == 1 ? one : many}';

String trainingDecimal(num value) => value % 1 == 0
    ? value.toInt().toString()
    : value.toString().replaceAll('.', ',');

num trainingNumber(Object? value, num min, num max, {num step = 1}) {
  if (value is! num ||
      !value.isFinite ||
      value < min ||
      value > max ||
      ((value / step).round() - value / step).abs() > 0.00001) {
    throw const FormatException('Parámetro de entrenamiento inválido');
  }
  return value;
}

class PrescribedSet {
  PrescribedSet(Map<String, Object?> json)
      : id = trainingText(json['id']),
        reps = trainingNumber(json['reps'], 1, 100).toInt(),
        repsMax = trainingOptional(json['repsMax'], 1, 100)?.toInt(),
        rpe = trainingOptional(json['rpe'], 1, 10, step: .5)?.toDouble(),
        rir = trainingOptional(json['rir'], 0, 10)?.toInt(),
        targetLoadKg = trainingOptional(json['targetLoadKg'], 0, 1000, step: .1)
            ?.toDouble() {
    if (repsMax != null && repsMax! < reps) {
      throw const FormatException('Rango de repeticiones inválido');
    }
  }
  final String id;
  final int reps;
  final int? repsMax;
  final double? rpe;
  final int? rir;
  final double? targetLoadKg;

  String get repsLabel =>
      repsMax == null ? '$reps reps' : '$reps–$repsMax reps';

  /// Everything the professional prescribed, omitting what was left blank.
  String get target => [
        repsLabel,
        if (rpe != null) 'RPE ${trainingDecimal(rpe!)}',
        if (rir != null) 'RIR $rir',
        if (targetLoadKg != null) '${trainingDecimal(targetLoadKg!)} kg',
      ].join(' · ');
}

class TrainingExercise {
  TrainingExercise(Map<String, Object?> json)
      : id = trainingText(json['id']),
        catalogId = json['catalogId'] as String?,
        name = trainingText(json['name']),
        instructions = json['instructions'] as String,
        loadMode = trainingText(json['loadMode']),
        restSeconds = trainingOptional(json['restSeconds'], 0, 900)?.toInt(),
        sets = trainingList(json['sets'], PrescribedSet.new),
        guidance = (json['guidance'] as List).map(trainingText).toList(),
        images = (json['images'] as List).map(trainingText).toList(),
        muscles = trainingStrings(json['muscles']),
        equipment = trainingStrings(json['equipment']),
        bodyPart = json['bodyPart'] as String? {
    if (!['external', 'bodyweight'].contains(loadMode) ||
        sets.isEmpty ||
        sets.length > 20 ||
        images.any((url) => Uri.tryParse(url)?.scheme != 'https')) {
      throw const FormatException('Ejercicio inválido');
    }
  }
  final String id, name, instructions, loadMode;
  final String? catalogId;
  final int? restSeconds;

  /// Stable identity across routine edits; matches the history `key`.
  String get key => catalogId ?? id;
  final List<PrescribedSet> sets;
  final List<String> guidance, images;

  /// Catalog facts; empty for custom exercises or older payloads.
  final List<String> muscles, equipment;
  final String? bodyPart;

  bool get bodyweight => loadMode == 'bodyweight';

  /// "3 × 8–12 reps · RPE 8" when every set shares a target, else "4 series".
  String get summary {
    final targets = sets.map((s) => s.target).toSet();
    return targets.length == 1
        ? '${sets.length} × ${targets.first}'
        : '${sets.length} series';
  }

  String? get restLabel {
    final rest = restSeconds;
    if (rest == null) return null;
    if (rest < 60 || rest % 30 != 0) {
      return 'Descanso $rest s';
    }
    final minutes = rest / 60;
    return 'Descanso ${trainingDecimal(minutes)} min';
  }
}

class TrainingDay {
  TrainingDay(Map<String, Object?> json)
      : id = trainingText(json['id']),
        name = trainingText(json['name']),
        kind = trainingText(json['kind']),
        date = json['date'] as String?,
        exercises = trainingList(json['exercises'], TrainingExercise.new) {
    if (!['training', 'rest'].contains(kind) ||
        (kind == 'rest' ? exercises.isNotEmpty : exercises.isEmpty)) {
      throw const FormatException('Día inválido');
    }
  }
  final String id, name, kind;
  final String? date;
  final List<TrainingExercise> exercises;

  int get setCount => exercises.fold(0, (total, e) => total + e.sets.length);
}

class TrainingPlan {
  TrainingPlan(Map<String, Object?> json)
      : id = trainingText(json['id']),
        name = trainingText(json['name']),
        clientId = trainingText(json['clientId']),
        schedule = trainingText(json['schedule']),
        startDate = trainingText(json['startDate']),
        number = trainingNumber(json['number'], 1, 2147483647).toInt(),
        days = trainingList(json['days'], TrainingDay.new) {
    if (json['published'] != true ||
        !['weekly', 'cycle', 'calendar'].contains(schedule) ||
        days.isEmpty) {
      throw const FormatException('Rutina no publicada');
    }
  }
  final String id, name, clientId, schedule, startDate;
  final int number;
  final List<TrainingDay> days;
  String get scheduleLabel => switch (schedule) {
        'weekly' => 'Semana fija',
        'cycle' => 'Ciclo de ${days.length} días',
        _ => 'Calendario por fechas'
      };

  /// Mirrors the API calendar rule so the week strip matches the server.
  TrainingDay? dayFor(String date) {
    final elapsed =
        trainingDate(date).difference(trainingDate(startDate)).inDays;
    if (elapsed < 0) return null;
    if (schedule == 'calendar') {
      for (final day in days) {
        if (day.date == date) return day;
      }
      return null;
    }
    final index = schedule == 'cycle'
        ? elapsed % days.length
        : trainingDate(date).weekday - 1;
    return index < days.length ? days[index] : null;
  }
}

DateTime trainingDate(String date) => DateTime.parse('${date}T12:00:00Z');
String trainingIso(DateTime date) => date.toIso8601String().substring(0, 10);
String shiftDate(String date, int days) =>
    trainingIso(trainingDate(date).add(Duration(days: days)));

class SetResult {
  SetResult(Map<String, Object?> json)
      : setId = trainingText(json['setId']),
        state = trainingText(json['state']),
        reps = trainingNumber(json['reps'], 0, 1000).toInt(),
        loadKg = json['loadKg'] == null
            ? null
            : trainingNumber(json['loadKg'], 0, 1000, step: .1).toDouble(),
        rpe = trainingOptional(json['rpe'], 1, 10, step: .5)?.toDouble(),
        rir = trainingOptional(json['rir'], 0, 10)?.toInt() {
    if (state == 'not_performed'
        ? reps != 0 || loadKg != null || rpe != null || rir != null
        : state != 'performed' || reps < 1 || loadKg == null) {
      throw const FormatException('Resultado inválido');
    }
  }
  final String setId, state;
  final int reps;
  final double? loadKg;
  final double? rpe;
  final int? rir;
}

class TrainingSession {
  TrainingSession(Map<String, Object?> json)
      : id = trainingText(json['id']),
        status = trainingText(json['status']),
        revision = trainingNumber(json['revision'], 1, 2147483647).toInt(),
        results = trainingList(json['results'], SetResult.new) {
    if (!['draft', 'finalized'].contains(status)) {
      throw const FormatException('Sesión inválida');
    }
  }
  final String id, status;
  final int revision;
  final List<SetResult> results;
}

class TrainingContext {
  TrainingContext(this.json)
      : clientId = trainingText(json['clientId']),
        localDate = trainingText(json['localDate']),
        today = trainingText(json['today']),
        timeZone = trainingText(json['timeZone']),
        canWrite = json['canWrite'] as bool,
        dayId = json['dayId'] as String?,
        plan = json['plan'] == null
            ? null
            : TrainingPlan(trainingObject(json['plan'])),
        session = json['session'] == null
            ? null
            : TrainingSession(trainingObject(json['session'])) {
    if (plan != null && plan!.clientId != clientId) {
      throw const FormatException('Rutina ajena');
    }
  }
  final Map<String, Object?> json;
  final String clientId, localDate, today, timeZone;
  final bool canWrite;
  final String? dayId;
  final TrainingPlan? plan;
  final TrainingSession? session;
  TrainingDay? get day {
    for (final day in plan?.days ?? <TrainingDay>[]) {
      if (day.id == dayId) return day;
    }
    return null;
  }
}

/// One exercise of a past session, with results aligned to the prescribed
/// sets (null = never marked).
class HistoryExercise {
  HistoryExercise(Map<String, Object?> json)
      : key = trainingText(json['key']),
        name = trainingText(json['name']),
        loadMode = trainingText(json['loadMode']),
        muscles = trainingStrings(json['muscles']),
        bodyPart = json['bodyPart'] as String?,
        sets = (json['sets'] as List)
            .map((s) => s == null ? null : SetResult(trainingObject(s)))
            .toList();
  final String key, name, loadMode;
  final List<String> muscles;
  final String? bodyPart;
  final List<SetResult?> sets;

  bool get bodyweight => loadMode == 'bodyweight';
  Iterable<SetResult> get performed =>
      sets.whereType<SetResult>().where((s) => s.state == 'performed');
}

class HistorySession {
  HistorySession(Map<String, Object?> json)
      : id = trainingText(json['id']),
        localDate = trainingText(json['localDate']),
        status = trainingText(json['status']),
        dayName = trainingText(json['dayName']),
        exercises = trainingList(json['exercises'], HistoryExercise.new) {
    trainingDate(localDate);
    if (!['draft', 'finalized'].contains(status)) {
      throw const FormatException('Sesión inválida');
    }
  }
  final String id, localDate, status, dayName;
  final List<HistoryExercise> exercises;
}

/// The client's own log, newest first.
class TrainingHistory {
  TrainingHistory(Map<String, Object?> json)
      : sessions = trainingList(json['sessions'], HistorySession.new),
        nextOffset = json['nextOffset'] as int?;
  TrainingHistory.empty()
      : sessions = const [],
        nextOffset = null;
  TrainingHistory.merged(TrainingHistory first, TrainingHistory next)
      : sessions = [...first.sessions, ...next.sessions],
        nextOffset = next.nextOffset;
  final List<HistorySession> sessions;
  final int? nextOffset;

  HistorySession? on(String date) {
    for (final s in sessions) {
      if (s.localDate == date) return s;
    }
    return null;
  }
}

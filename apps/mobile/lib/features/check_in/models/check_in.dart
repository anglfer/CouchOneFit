import '../../training/models/training.dart';

/// Visible labels of the DEC-006 nutrition compliance enum.
const complianceLabels = {
  'completed': 'Cumplí',
  'partial': 'A medias',
  'not_completed': 'No cumplí',
  'not_applicable': 'No aplica',
};

int? _scale(Object? value) =>
    value == null ? null : trainingNumber(value, 1, 5).toInt();
double? _decimal(Object? value, num min, num max, num step) =>
    trainingOptional(value, min, max, step: step)?.toDouble();
String? _optionalText(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('Texto inválido');
  return value;
}

class CheckIn {
  CheckIn(Map<String, Object?> json)
      : id = trainingText(json['id']),
        localDate = trainingText(json['localDate']),
        revision = trainingNumber(json['revision'], 1, 2147483646).toInt(),
        bodyWeightKg = _decimal(json['bodyWeightKg'], 30, 300, 0.1),
        sleepHours = _decimal(json['sleepHours'], 0, 24, 0.5),
        stress = _scale(json['stress']),
        energy = _scale(json['energy']),
        hunger = _scale(json['hunger']),
        nutritionCompliance = _optionalText(json['nutritionCompliance']),
        comment = _optionalText(json['comment']) {
    if (nutritionCompliance != null &&
        !complianceLabels.containsKey(nutritionCompliance)) {
      throw const FormatException('Cumplimiento inválido');
    }
  }
  final String id, localDate;
  final int revision;
  final double? bodyWeightKg, sleepHours;
  final int? stress, energy, hunger;
  final String? nutritionCompliance, comment;
}

/// What the check-in screen needs for one date of the correction window.
class CheckInContext {
  CheckInContext(Map<String, Object?> json)
      : clientId = trainingText(json['clientId']),
        today = trainingText(json['today']),
        localDate = trainingText(json['localDate']),
        canWrite = json['canWrite'] == true,
        dates = trainingList(json['dates'],
            (d) => (trainingText(d['localDate']), d['recorded'] == true)),
        checkIn = json['checkIn'] == null
            ? null
            : CheckIn(trainingObject(json['checkIn'])),
        nutritionApplicable =
            trainingObject(json['nutrition'])['applicable'] == true,
        nutritionPlanName =
            _optionalText(trainingObject(json['nutrition'])['planName']),
        training =
            json['training'] == null ? null : trainingObject(json['training']);
  final String clientId, today, localDate;
  final bool canWrite, nutritionApplicable;
  final List<(String, bool)> dates;
  final CheckIn? checkIn;
  final String? nutritionPlanName;
  final Map<String, Object?>? training;

  /// "Tren inferior · finalizado", "Descanso" or null without a routine.
  String? get trainingLabel {
    final t = training;
    if (t == null) return null;
    if (t['kind'] == 'rest') return 'Día de descanso';
    final status = switch (t['sessionStatus']) {
      'finalized' => 'entrenamiento registrado',
      'draft' => 'entrenamiento en curso',
      _ => 'sin registrar',
    };
    return '${t['dayName']} · $status';
  }

  /// Earlier dates of the window still without a check-in.
  List<String> get missing => [
        for (final (date, recorded) in dates)
          if (!recorded && date != today) date
      ];
}

class AdherenceSummary {
  AdherenceSummary(Map<String, Object?> json)
      : applicableDays =
            trainingNumber(json['applicableDays'], 0, 100000).toInt(),
        recordedDays = trainingNumber(json['recordedDays'], 0, 100000).toInt(),
        observedPercent =
            trainingOptional(json['observedPercent'], 0, 100)?.toInt(),
        coveragePercent =
            trainingOptional(json['coveragePercent'], 0, 100)?.toInt();
  final int applicableDays, recordedDays;
  final int? observedPercent, coveragePercent;
}

class Measurement {
  Measurement(Map<String, Object?> json)
      : date = trainingText(json['date']),
        source = _optionalText(json['source']) ?? 'professional_evaluation',
        method = _optionalText(json['method']),
        weightKg = _decimal(json['weightKg'], 0, 1000, 0.1),
        waistCm = _decimal(json['waistCm'], 0, 1000, 0.1),
        hipCm = _decimal(json['hipCm'], 0, 1000, 0.1),
        bodyFatPercentage = _decimal(json['bodyFatPercentage'], 0, 100, 0.1);
  final String date, source;
  final String? method;
  final double? weightKg, waistCm, hipCm, bodyFatPercentage;
}

/// HU-036 aggregate: hidden categories are absent, never empty lists.
class SharedProgress {
  SharedProgress(Map<String, Object?> json)
      : measurementsShared =
            trainingObject(json['visibility'])['measurements'] == true,
        adherenceShared =
            trainingObject(json['visibility'])['adherence'] == true,
        measurements = json['measurements'] == null
            ? null
            : trainingList(json['measurements'], Measurement.new),
        training = json['adherence'] == null
            ? null
            : AdherenceSummary(
                trainingObject(trainingObject(json['adherence'])['training'])),
        nutrition = json['adherence'] == null
            ? null
            : AdherenceSummary(
                trainingObject(trainingObject(json['adherence'])['nutrition']));
  final bool measurementsShared, adherenceShared;
  final List<Measurement>? measurements;
  final AdherenceSummary? training, nutrition;
}

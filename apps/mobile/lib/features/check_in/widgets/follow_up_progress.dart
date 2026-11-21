import 'package:flutter/material.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/section_title.dart';
import '../../training/models/training.dart';
import '../../training/screens/training_views.dart';
import '../models/check_in.dart';
import '../services/check_in_service.dart';

/// Progreso: own body weight & check-ins (always visible, the client wrote
/// them) and what the professional shares (HU-036). Loaded fresh, never cached.
class FollowUpProgress extends StatefulWidget {
  const FollowUpProgress({super.key, required this.service});
  final CheckInService service;
  @override
  State<FollowUpProgress> createState() => _FollowUpProgressState();
}

class _FollowUpProgressState extends State<FollowUpProgress> {
  List<CheckIn>? _history;
  SharedProgress? _shared;
  String? _historyError, _sharedError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _historyError = _sharedError = null);
    await Future.wait([
      widget.service.history().then((v) {
        if (mounted) setState(() => _history = v);
      }).catchError((Object _) {
        if (mounted) {
          setState(
              () => _historyError = 'No pudimos consultar tu peso. Reintenta.');
        }
      }),
      widget.service.progress().then((v) {
        if (mounted) setState(() => _shared = v);
      }).catchError((Object _) {
        // A failed read discards what was shown: a revoked category never lingers.
        if (mounted) {
          setState(() {
            _shared = null;
            _sharedError =
                'No pudimos consultar lo que comparte tu profesional. Reintenta.';
          });
        }
      }),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 24),
      const SectionTitle('Peso corporal'),
      const SizedBox(height: 12),
      if (_historyError != null)
        NoticeBanner(
            text: _historyError!, tone: NoticeTone.error, onRetry: _load)
      else if (_history != null) ...[
        _weightCard(context, _history!),
        if (_history!.isNotEmpty) ...[
          const SizedBox(height: 12),
          _recentCheckInsCard(context, _history!),
        ],
      ],
      const SizedBox(height: 24),
      const SectionTitle('Compartido por tu profesional'),
      const SizedBox(height: 12),
      if (_sharedError != null)
        NoticeBanner(
            text: _sharedError!, tone: NoticeTone.error, onRetry: _load)
      else if (_shared != null)
        ..._sharedCards(context, _shared!),
    ]);
  }

  Widget _weightCard(BuildContext context, List<CheckIn> history) {
    final colors = Theme.of(context).colorScheme;
    final weights =
        history.where((c) => c.bodyWeightKg != null).toList().reversed.toList();
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: weights.isEmpty
                ? Text(
                    'Aún no registras tu peso. Agrégalo en tu check-in diario para ver tu tendencia.',
                    style: TextStyle(color: colors.onSurfaceVariant))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                        Text('Check-in diario · kg',
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: colors.onSurfaceVariant)),
                        const SizedBox(height: 4),
                        Text(
                            '${trainingDecimal(weights.last.bodyWeightKg!)} kg',
                            style: const TextStyle(
                                fontSize: 26, fontWeight: FontWeight.w800)),
                        Text(
                            weights.length > 1
                                ? '${_signed(weights.last.bodyWeightKg! - weights.first.bodyWeightKg!)} kg desde el ${shortDate(weights.first.localDate)}'
                                : 'Registrado el ${shortDate(weights.last.localDate)}',
                            style: TextStyle(color: colors.onSurfaceVariant)),
                        if (weights.length > 1) ...[
                          const SizedBox(height: 12),
                          TrendChart(
                              values: [
                                for (final w in weights) w.bodyWeightKg!
                              ],
                              height: 90,
                              axis: true,
                              label:
                                  'Peso corporal de ${trainingDecimal(weights.first.bodyWeightKg!)} a ${trainingDecimal(weights.last.bodyWeightKg!)} kilos en ${weights.length} registros',
                              firstLabel: shortDate(weights.first.localDate),
                              lastLabel: shortDate(weights.last.localDate)),
                        ],
                      ])));
  }

  Widget _recentCheckInsCard(BuildContext context, List<CheckIn> history) {
    final colors = Theme.of(context).colorScheme;
    final items = history.take(5).toList();
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const CardTitle(
                      icon: Icons.fact_check_outlined,
                      title: 'Últimos check-ins'),
                  const SizedBox(height: 8),
                  for (final (idx, item) in items.indexed) ...[
                    if (idx > 0)
                      Divider(height: 16, color: colors.outlineVariant),
                    _checkInSummaryRow(context, item),
                  ],
                ])));
  }

  Widget _checkInSummaryRow(BuildContext context, CheckIn item) {
    final colors = Theme.of(context).colorScheme;
    final details = <String>[
      if (item.bodyWeightKg != null)
        'Peso ${trainingDecimal(item.bodyWeightKg!)} kg',
      if (item.sleepHours != null)
        'Sueño ${trainingDecimal(item.sleepHours!)} h',
      if (item.stress != null) 'Estrés ${item.stress}/5',
      if (item.energy != null) 'Energía ${item.energy}/5',
      if (item.hunger != null) 'Hambre ${item.hunger}/5',
      if (item.nutritionCompliance != null &&
          item.nutritionCompliance != 'not_applicable')
        complianceLabels[item.nutritionCompliance] ?? item.nutritionCompliance!,
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
            child: Text(capitalized(shortDate(item.localDate)),
                style: const TextStyle(fontWeight: FontWeight.w700))),
        if (item.revision > 1)
          Text('Corregido',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: colors.onSurfaceVariant)),
      ]),
      if (details.isNotEmpty) ...[
        const SizedBox(height: 2),
        Text(details.join(' · '),
            style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant)),
      ],
      if (item.comment != null && item.comment!.isNotEmpty) ...[
        const SizedBox(height: 2),
        Text(item.comment!, style: const TextStyle(fontSize: 13)),
      ],
    ]);
  }

  static String _signed(double delta) =>
      '${delta >= 0 ? '+' : '−'}${trainingDecimal(double.parse(delta.abs().toStringAsFixed(1)))}';

  static String _coverageText(String prefix, AdherenceSummary s) => s
              .applicableDays ==
          0
      ? '$prefix: sin días con plan'
      : '$prefix: cobertura ${s.coveragePercent ?? 0} % (${s.recordedDays} de ${s.applicableDays} d)';

  static String _methodLabel(String? method) => switch (method) {
        'perimetros' => 'Perímetros',
        'pliegues' => 'Pliegues',
        'bioimpedancia' => 'Bioimpedancia',
        _ => '',
      };

  List<Widget> _sharedCards(BuildContext context, SharedProgress shared) {
    final colors = Theme.of(context).colorScheme;
    if (!shared.measurementsShared && !shared.adherenceShared) {
      return [
        Text(
            'Tu profesional aún no comparte tus medidas ni tu adherencia. Cuando lo haga, aparecerán aquí.',
            style: TextStyle(color: colors.onSurfaceVariant)),
      ];
    }
    String pct(int? v) => v == null ? '—' : '$v %';
    final measurements = shared.measurements ?? const <Measurement>[];
    final ordered = measurements.reversed.toList();
    final trendWeights = [
      for (final m in ordered)
        if (m.weightKg != null) (m.date, m.weightKg!)
    ];
    final trendWaists = [
      for (final m in ordered)
        if (m.waistCm != null) (m.date, m.waistCm!)
    ];
    final trendFat = [
      for (final m in ordered)
        if (m.bodyFatPercentage != null) (m.date, m.bodyFatPercentage!)
    ];
    final (trendLabel, trendSeries, trendUnit) = trendWeights.length >= 2
        ? ('Peso en evaluaciones (kg)', trendWeights, 'kilos')
        : trendWaists.length >= 2
            ? ('Cintura en evaluaciones (cm)', trendWaists, 'centímetros')
            : ('Grasa corporal (%)', trendFat, 'por ciento');

    return [
      if (shared.adherenceShared &&
          shared.training != null &&
          shared.nutrition != null) ...[
        StatPanel(tiles: [
          StatTile(
              icon: Icons.fitness_center,
              label: 'Entrenamiento (4 sem.)',
              value: pct(shared.training!.observedPercent)),
          StatTile(
              icon: Icons.restaurant_outlined,
              label: 'Alimentación (4 sem.)',
              value: pct(shared.nutrition!.observedPercent)),
        ]),
        const SizedBox(height: 8),
        Text(
            '${_coverageText('Entrenamiento', shared.training!)} · ${_coverageText('Alimentación', shared.nutrition!)}',
            style: TextStyle(fontSize: 12.5, color: colors.onSurfaceVariant)),
        const SizedBox(height: 4),
        Text(
            'Solo cuentan los días con plan; descansos y días sin registro no te restan.',
            style: TextStyle(fontSize: 12.5, color: colors.onSurfaceVariant)),
        if (!shared.measurementsShared) ...[
          const SizedBox(height: 8),
          Text('Tus medidas de evaluación siguen privadas.',
              style: TextStyle(fontSize: 12.5, color: colors.onSurfaceVariant)),
        ],
      ],
      if (shared.measurementsShared) ...[
        if (shared.adherenceShared) const SizedBox(height: 12),
        Card(
            margin: EdgeInsets.zero,
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: measurements.isEmpty
                    ? Text('Tu profesional aún no registra evaluaciones.',
                        style: TextStyle(color: colors.onSurfaceVariant))
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                            Text('Evaluación profesional',
                                style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: colors.onSurfaceVariant)),
                            const SizedBox(height: 4),
                            CardTitle(
                                icon: Icons.straighten_outlined,
                                title:
                                    'Última evaluación · ${shortDate(measurements.first.date)}'),
                            if (trendSeries.length >= 2) ...[
                              const SizedBox(height: 10),
                              Text(trendLabel,
                                  style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: colors.onSurfaceVariant)),
                              const SizedBox(height: 6),
                              TrendChart(
                                  values: [
                                    for (final (_, val) in trendSeries) val
                                  ],
                                  height: 90,
                                  axis: true,
                                  label:
                                      '$trendLabel de ${trainingDecimal(trendSeries.first.$2)} a ${trainingDecimal(trendSeries.last.$2)} $trendUnit en ${trendSeries.length} evaluaciones',
                                  firstLabel: shortDate(trendSeries.first.$1),
                                  lastLabel: shortDate(trendSeries.last.$1)),
                            ],
                            const SizedBox(height: 8),
                            for (final (index, item)
                                in measurements.take(6).indexed) ...[
                              if (index > 0)
                                Divider(
                                    height: 16, color: colors.outlineVariant),
                              _evaluationRow(context, item),
                            ],
                            if (measurements.length > 1)
                              Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                      '${measurements.length} evaluaciones en tu historial',
                                      style: TextStyle(
                                          color: colors.onSurfaceVariant,
                                          fontSize: 12.5))),
                          ]))),
        if (!shared.adherenceShared) ...[
          const SizedBox(height: 8),
          Text('Tu adherencia sigue privada.',
              style: TextStyle(fontSize: 12.5, color: colors.onSurfaceVariant)),
        ],
      ],
    ];
  }

  Widget _evaluationRow(BuildContext context, Measurement item) {
    final colors = Theme.of(context).colorScheme;
    final method = _methodLabel(item.method);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
            child: Text(capitalized(shortDate(item.date)),
                style: const TextStyle(fontWeight: FontWeight.w700))),
        if (method.isNotEmpty)
          Text(method,
              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
      ]),
      const SizedBox(height: 4),
      for (final (label, value, unit) in [
        ('Peso', item.weightKg, 'kg'),
        ('Cintura', item.waistCm, 'cm'),
        ('Cadera', item.hipCm, 'cm'),
        ('Grasa corporal', item.bodyFatPercentage, '%'),
      ])
        if (value != null)
          Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Expanded(child: Text(label)),
                Text('${trainingDecimal(value)} $unit',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ])),
    ]);
  }
}

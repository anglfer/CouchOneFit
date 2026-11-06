import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import '../widgets/muscle_map.dart';
import 'training_views.dart';

class SummaryExercise {
  const SummaryExercise(this.name, this.best, this.change, this.record);
  final String name;

  /// Best set today ("70×10"), or null when nothing was performed.
  final String? best;

  /// "+2,5 kg" / "= última vez" against last time, when there is one.
  final String? change;
  final bool record;
}

/// Shown right after finishing: what was done and how it compares.
class SessionSummaryScreen extends StatelessWidget {
  const SessionSummaryScreen(
      {super.key,
      required this.dayName,
      required this.date,
      required this.duration,
      required this.sets,
      required this.volume,
      required this.exercises,
      required this.groups,
      this.onShowProgress});
  final String dayName, date;
  final Duration duration;
  final int sets;
  final double volume;
  final List<SummaryExercise> exercises;
  final List<MapEntry<String, int>> groups;
  final VoidCallback? onShowProgress;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final records = exercises.where((e) => e.record).length;
    return Scaffold(
        body: DecoratedBox(
            decoration: brandGlow(context),
            child: SafeArea(
                child: ListView(padding: const EdgeInsets.all(20), children: [
              Center(
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 12),
                            Center(
                                child: Container(
                                    padding: const EdgeInsets.all(20),
                                    decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: BrandColors.success,
                                        boxShadow: [
                                          BoxShadow(
                                              color: BrandColors.success
                                                  .withValues(alpha: 0.36),
                                              blurRadius: 28,
                                              offset: const Offset(0, 8))
                                        ]),
                                    child: const Icon(Icons.check_rounded,
                                        size: 44, color: Colors.white))),
                            const SizedBox(height: 18),
                            Semantics(
                                header: true,
                                child: Text('¡Entrenamiento completado!',
                                    textAlign: TextAlign.center,
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineSmall
                                        ?.copyWith(
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: -0.5))),
                            const SizedBox(height: 4),
                            Text('$dayName · ${capitalized(longDate(date))}',
                                textAlign: TextAlign.center,
                                style:
                                    TextStyle(color: colors.onSurfaceVariant)),
                            const SizedBox(height: 22),
                            Row(children: [
                              Expanded(
                                  child: StatTile(
                                      icon: Icons.timer_outlined,
                                      label: 'Tiempo',
                                      value: clockLabel(duration))),
                              const SizedBox(width: 10),
                              Expanded(
                                  child: StatTile(
                                      icon: Icons.repeat,
                                      label: 'Series',
                                      value: '$sets')),
                            ]),
                            const SizedBox(height: 10),
                            Row(children: [
                              Expanded(
                                  child: StatTile(
                                      icon: Icons.bar_chart_rounded,
                                      label: 'Volumen',
                                      value:
                                          '${trainingThousands(volume)} kg')),
                              const SizedBox(width: 10),
                              Expanded(
                                  child: StatTile(
                                      icon: Icons.emoji_events_outlined,
                                      label: 'Récords',
                                      value: '$records',
                                      highlight: records > 0)),
                            ]),
                            const SizedBox(height: 24),
                            const TrainingEyebrow('Cómo te fue'),
                            const SizedBox(height: 8),
                            for (final e in exercises)
                              Card(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: ListTile(
                                      leading: Container(
                                          width: 38,
                                          height: 38,
                                          decoration: BoxDecoration(
                                              color: (e.record
                                                      ? BrandColors.warning
                                                      : e.best == null
                                                          ? colors
                                                              .onSurfaceVariant
                                                          : BrandColors.success)
                                                  .withValues(alpha: 0.14),
                                              borderRadius:
                                                  BorderRadius.circular(11)),
                                          child: Icon(
                                              e.record
                                                  ? Icons.emoji_events
                                                  : e.best == null
                                                      ? Icons
                                                          .remove_circle_outline
                                                      : Icons
                                                          .check_circle_outline,
                                              size: 20,
                                              color: e.record
                                                  ? BrandColors.warning
                                                  : e.best == null
                                                      ? colors.onSurfaceVariant
                                                      : BrandColors.success)),
                                      title: Text(e.name,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700)),
                                      subtitle: Text([
                                        e.best == null
                                            ? 'Sin series hechas'
                                            : 'Mejor serie: ${e.best}',
                                        if (e.record) '¡Récord personal!',
                                      ].join(' · ')),
                                      trailing: e.change == null
                                          ? null
                                          : Text(e.change!,
                                              style: TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  color: e.change!
                                                          .startsWith('+')
                                                      ? BrandColors.success
                                                      : colors
                                                          .onSurfaceVariant)))),
                            if (groups.isNotEmpty) ...[
                              const SizedBox(height: 18),
                              const TrainingEyebrow('Músculos trabajados'),
                              const SizedBox(height: 10),
                              Card(
                                  margin: EdgeInsets.zero,
                                  child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            MuscleMap(
                                                height: 200,
                                                // More sets, stronger tint.
                                                fill: {
                                                  for (final g in groups)
                                                    g.key: colors.primary
                                                        .withValues(
                                                            alpha: .35 +
                                                                .65 *
                                                                    g.value /
                                                                    groups.first
                                                                        .value)
                                                },
                                                semanticsLabel:
                                                    'Figura muscular con ${groups.map((g) => g.key).join(', ')}'),
                                            const SizedBox(height: 14),
                                            Wrap(
                                                spacing: 8,
                                                runSpacing: 8,
                                                children: [
                                                  for (final g in groups)
                                                    TrainingChip(
                                                        '${g.key} · ${trainingCount(g.value, 'serie', 'series')}',
                                                        icon: Icons
                                                            .accessibility_new),
                                                ]),
                                          ]))),
                            ],
                            const SizedBox(height: 28),
                            FilledButton(
                                onPressed: () => Navigator.pop(context),
                                child: const Text('Listo')),
                            if (onShowProgress != null) ...[
                              const SizedBox(height: 8),
                              OutlinedButton.icon(
                                  onPressed: () {
                                    Navigator.pop(context);
                                    onShowProgress!();
                                  },
                                  icon: const Icon(Icons.insights_outlined),
                                  label: const Text('Ver mi progreso')),
                            ],
                          ])))
            ]))));
  }
}

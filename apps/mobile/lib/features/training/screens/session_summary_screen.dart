import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/animations/reveal_in.dart';
import '../../../shared/widgets/detail_scaffold.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/icon_badge.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import '../widgets/muscle_map.dart';
import '../../../shared/widgets/section_title.dart';
import 'training_views.dart';

class SummaryExercise {
  const SummaryExercise(this.name, this.best, this.change, this.record,
      {this.next, this.nextUp = false});
  final String name;

  /// Load advice for next time ("Próxima vez: sube a 52,5 kg").
  final String? next;
  final bool nextUp;

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
    return DetailScaffold(children: [
      RevealIn(
          beginScale: .8,
          child: Center(
              child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: BrandColors.success,
                      boxShadow: [
                        BoxShadow(
                            color: BrandColors.success.withValues(alpha: .35),
                            blurRadius: 32,
                            offset: const Offset(0, 10))
                      ]),
                  child: const Icon(Icons.check_rounded,
                      size: 44, color: BrandColors.onSuccess)))),
      const SizedBox(height: 18),
      Semantics(
          header: true,
          child: Text('¡Entrenamiento completado!',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 28, height: 1.12, fontWeight: FontWeight.w800))),
      const SizedBox(height: 6),
      Text('$dayName · ${capitalized(longDate(date))}',
          textAlign: TextAlign.center,
          style: TextStyle(color: colors.onSurfaceVariant)),
      const SizedBox(height: 22),
      StatPanel(tiles: [
        StatTile(
            icon: Icons.timer_outlined,
            label: 'Tiempo',
            value: clockLabel(duration)),
        StatTile(icon: Icons.repeat, label: 'Series', value: '$sets'),
        StatTile(
            icon: Icons.bar_chart_rounded,
            label: 'Volumen',
            value: '${trainingThousands(volume)} kg'),
        StatTile(
            icon: Icons.emoji_events_outlined,
            label: 'Récords',
            value: '$records',
            highlight: records > 0),
      ]),
      if (groups.isNotEmpty) ...[
        const SizedBox(height: 24),
        const SectionTitle('Músculos trabajados'),
        const SizedBox(height: 10),
        Card(
            margin: EdgeInsets.zero,
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      MuscleMap(
                          height: 260,
                          // More sets, stronger tint.
                          fill: {
                            for (final g in groups)
                              g.key: colors.primary.withValues(
                                  alpha:
                                      .35 + .65 * g.value / groups.first.value)
                          },
                          semanticsLabel:
                              'Figura muscular con ${groups.map((g) => g.key).join(', ')}'),
                      const SizedBox(height: 14),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final g in groups)
                          TrainingChip(
                              '${g.key} · ${trainingCount(g.value, 'serie', 'series')}',
                              icon: Icons.accessibility_new),
                      ]),
                    ]))),
      ],
      const SizedBox(height: 24),
      const SectionTitle('Cómo te fue'),
      const SizedBox(height: 10),
      GroupCard(indent: 68, children: [
        for (final e in exercises)
          ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              leading: IconBadge(
                  e.record
                      ? Icons.emoji_events
                      : e.best == null
                          ? Icons.remove_circle_outline
                          : Icons.check_circle_outline,
                  tint: e.record
                      ? BrandColors.warning
                      : e.best == null
                          ? colors.onSurfaceVariant
                          : BrandColors.success),
              title: Text(e.name),
              subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text([
                      e.best == null
                          ? 'Sin series hechas'
                          : 'Mejor serie: ${e.best}',
                      if (e.record) '¡Récord personal!',
                    ].join(' · ')),
                    if (e.next != null)
                      Text(e.next!,
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: e.nextUp
                                  ? statusInk(context, BrandColors.success)
                                  : colors.secondary)),
                  ]),
              trailing: e.change == null
                  ? null
                  : Text(e.change!,
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: e.change!.startsWith('+')
                              ? statusInk(context, BrandColors.success)
                              : colors.onSurfaceVariant))),
      ]),
      const SizedBox(height: 28),
      GradientActionButton(
          label: 'Listo',
          icon: Icons.check_rounded,
          onPressed: () => Navigator.pop(context)),
      if (onShowProgress != null) ...[
        const SizedBox(height: 10),
        OutlinedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              onShowProgress!();
            },
            icon: const Icon(Icons.insights_outlined),
            label: const Text('Ver mi progreso')),
      ],
    ]);
  }
}

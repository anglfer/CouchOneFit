import 'package:flutter/material.dart';
import '../../../shared/widgets/coming_soon_card.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/status_view.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import '../../../shared/widgets/section_title.dart';
import 'training_views.dart';

const _weekdayShort = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/// Planes: what the professional assigned, one segment per module.
class PlansTab extends StatefulWidget {
  const PlansTab(
      {super.key,
      required this.plan,
      required this.today,
      required this.onShowDay});
  final TrainingPlan? plan;
  final String today;
  final ValueChanged<TrainingDay> onShowDay;
  @override
  State<PlansTab> createState() => _PlansTabState();
}

class _PlansTabState extends State<PlansTab> {
  bool _nutrition = false;
  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ChoiceBar<bool>(
          options: const [(false, 'Entrenamiento'), (true, 'Alimentación')],
          icons: const [Icons.fitness_center, Icons.restaurant_outlined],
          selected: _nutrition,
          onChanged: (v) => setState(() => _nutrition = v)),
      const SizedBox(height: 16),
      if (_nutrition)
        const ComingSoonCard(
            icon: Icons.restaurant_menu_outlined,
            title: 'Plan de alimentación',
            description:
                'Aquí verás las comidas, cantidades e indicaciones que te asigne tu profesional.')
      else if (plan != null)
        ..._training(context, plan)
      else
        const StatusView(
            icon: Icons.event_note_outlined,
            title: 'Todavía no tienes una rutina asignada',
            message: 'Tu profesional la compartirá aquí cuando esté lista.'),
    ]);
  }

  List<Widget> _training(BuildContext context, TrainingPlan plan) {
    final colors = Theme.of(context).colorScheme;
    final todayDay = plan.dayFor(widget.today);
    final description = switch (plan.schedule) {
      'weekly' => 'Las mismas rutinas los mismos días, cada semana.',
      'cycle' =>
        'Repites los ${plan.days.length} días en orden, sin importar el día de la semana.',
      _ => 'Cada sesión tiene una fecha asignada.',
    };
    final workoutDays = plan.days.where((d) => d.kind != 'rest').length;
    final totalSets = plan.days.fold<int>(0, (t, d) => t + d.setCount);
    return [
      Card(
          margin: EdgeInsets.zero,
          child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(plan.name,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontSize: 22, height: 1.15)),
                    const SizedBox(height: 4),
                    Text(
                        '${plan.scheduleLabel} · desde ${shortDate(plan.startDate)}',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: colors.onSurfaceVariant)),
                    const SizedBox(height: 12),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      TrainingChip(
                          trainingCount(
                              workoutDays, 'día activo', 'días activos'),
                          icon: Icons.bolt_outlined),
                      TrainingChip(trainingCount(totalSets, 'serie', 'series'),
                          icon: Icons.repeat),
                    ]),
                    const SizedBox(height: 12),
                    Text(
                        '$description Tu profesional diseña y ajusta esta rutina.',
                        style: TextStyle(
                            fontSize: 13.5,
                            height: 1.4,
                            color: colors.onSurfaceVariant)),
                  ]))),
      const SizedBox(height: 22),
      SectionTitle(plan.schedule == 'weekly' ? 'Tu semana' : 'Tus días'),
      const SizedBox(height: 10),
      GroupCard(children: [
        for (final entry in plan.days.asMap().entries)
          _dayRow(context, plan, entry.key, entry.value,
              entry.value.id == todayDay?.id),
      ]),
      const SizedBox(height: 12),
      Text('Animaciones de ejercicios: © Gym visual · gymvisual.com',
          style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
    ];
  }

  Widget _dayRow(BuildContext context, TrainingPlan plan, int index,
      TrainingDay day, bool today) {
    final colors = Theme.of(context).colorScheme;
    final rest = day.kind == 'rest';
    final label = plan.schedule == 'weekly' && index < 7
        ? _weekdayShort[index]
        : day.date != null
            ? shortDate(day.date!)
            : 'D${index + 1}';
    final groups = rest ? const <String>[] : dayGroups(day);
    return Material(
        color: today ? colors.primaryContainer : Colors.transparent,
        child: InkWell(
            onTap: () => widget.onShowDay(day),
            child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                child: Row(children: [
                  SizedBox(
                      width: 44,
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: today
                                  ? colors.onSurface
                                  : colors.onSurfaceVariant))),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(day.name,
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight:
                                    rest ? FontWeight.w600 : FontWeight.w800,
                                color: rest && !today
                                    ? colors.onSurfaceVariant
                                    : colors.onSurface)),
                        const SizedBox(height: 2),
                        Text(
                            rest
                                ? 'Recuperar también suma'
                                : [
                                    trainingCount(day.exercises.length,
                                        'ejercicio', 'ejercicios'),
                                    if (groups.isNotEmpty)
                                      groups.take(3).join(', '),
                                  ].join(' · '),
                            style: TextStyle(
                                fontSize: 13,
                                height: 1.3,
                                color: colors.onSurfaceVariant)),
                      ])),
                  if (today)
                    const Padding(
                        padding: EdgeInsets.only(left: 6, right: 2),
                        child: TonePill('Hoy')),
                  Icon(Icons.chevron_right_rounded,
                      color: colors.onSurfaceVariant),
                ]))));
  }
}

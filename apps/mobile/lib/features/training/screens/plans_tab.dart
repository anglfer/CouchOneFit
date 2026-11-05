import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/coming_soon_card.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
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
      SegmentedButton<bool>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
                value: false,
                icon: Icon(Icons.fitness_center),
                label: Text('Entrenamiento')),
            ButtonSegment(
                value: true,
                icon: Icon(Icons.restaurant_outlined),
                label: Text('Alimentación')),
          ],
          selected: {_nutrition},
          onSelectionChanged: (s) => setState(() => _nutrition = s.first)),
      const SizedBox(height: 16),
      if (_nutrition)
        const ComingSoonCard(
            icon: Icons.restaurant_menu_outlined,
            title: 'Plan de alimentación',
            description:
                'Aquí verás las comidas, cantidades e indicaciones que te asigne tu profesional.')
      else if (plan != null)
        ..._training(context, plan),
    ]);
  }

  List<Widget> _training(BuildContext context, TrainingPlan plan) {
    final colors = Theme.of(context).colorScheme;
    final todayDay = plan.dayFor(widget.today);
    final (icon, description) = switch (plan.schedule) {
      'weekly' => (
          Icons.event_repeat,
          'Las mismas rutinas los mismos días, cada semana.'
        ),
      'cycle' => (
          Icons.autorenew,
          'Repites los ${plan.days.length} días en orden, sin importar el día de la semana.'
        ),
      _ => (Icons.event_note, 'Cada sesión tiene una fecha asignada.'),
    };
    return [
      Card(
          margin: EdgeInsets.zero,
          child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Container(
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                              color: BrandColors.warning,
                              borderRadius: BorderRadius.circular(11)),
                          child: Icon(icon, color: Colors.white, size: 20)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(plan.name,
                                style: const TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.w800)),
                            Text(
                                '${plan.scheduleLabel} · desde ${shortDate(plan.startDate)}',
                                style:
                                    TextStyle(color: colors.onSurfaceVariant)),
                          ])),
                    ]),
                    const SizedBox(height: 10),
                    Text(description,
                        style: TextStyle(color: colors.onSurfaceVariant)),
                    const SizedBox(height: 4),
                    Text('Tu profesional diseña y ajusta esta rutina.',
                        style: TextStyle(
                            fontSize: 12, color: colors.onSurfaceVariant)),
                  ]))),
      const SizedBox(height: 18),
      TrainingEyebrow(plan.schedule == 'weekly' ? 'Tu semana' : 'Tus días'),
      const SizedBox(height: 8),
      for (final entry in plan.days.asMap().entries)
        _dayRow(context, plan, entry.key, entry.value,
            entry.value.id == todayDay?.id),
      const SizedBox(height: 12),
      Text('Datos de ejercicios: RepDB · repdb.co',
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
    return Card(
        margin: const EdgeInsets.only(bottom: 10),
        shape: today
            ? RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: colors.primary, width: 2))
            : null,
        child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => widget.onShowDay(day),
            child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(children: [
                  SizedBox(
                      width: 44,
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: today
                                  ? colors.primary
                                  : colors.onSurfaceVariant))),
                  Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                          gradient: rest ? null : BrandColors.gradient,
                          color: rest ? colors.surfaceContainerHighest : null,
                          borderRadius: BorderRadius.circular(11)),
                      child: Icon(
                          rest ? Icons.bedtime_outlined : Icons.fitness_center,
                          size: 20,
                          color:
                              rest ? colors.onSurfaceVariant : Colors.white)),
                  const SizedBox(width: 12),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(day.name,
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700)),
                        Text(
                            rest
                                ? 'Recuperar también suma'
                                : [
                                    trainingCount(day.exercises.length,
                                        'ejercicio', 'ejercicios'),
                                    if (groups.isNotEmpty)
                                      groups.take(3).join(', '),
                                  ].join(' · '),
                            style: TextStyle(color: colors.onSurfaceVariant)),
                      ])),
                  if (today)
                    Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: Text('Hoy',
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: colors.primary))),
                  Icon(Icons.chevron_right, color: colors.onSurfaceVariant),
                ]))));
  }
}

import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/coming_soon_card.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import '../widgets/muscle_map.dart';
import 'progress_tab.dart';
import 'training_views.dart';

/// Inicio: a browsable week, the selected day's workout, recovery and what
/// is coming next.
class HomeTab extends StatefulWidget {
  const HomeTab(
      {super.key,
      required this.data,
      required this.history,
      required this.canLog,
      required this.opening,
      required this.onStart,
      required this.onShowDay,
      required this.onOpenProgress});
  final TrainingContext data;
  final TrainingHistory? history;
  final bool canLog, opening;
  final ValueChanged<String> onStart;
  final ValueChanged<TrainingDay> onShowDay;
  final VoidCallback onOpenProgress;
  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  int _week = 0;
  String? _selected;

  TrainingContext get data => widget.data;
  TrainingHistory? get history => widget.history;

  @override
  Widget build(BuildContext context) {
    final plan = data.plan;
    final recoveries = history == null
        ? const <GroupRecovery>[]
        : recovery(history!, data.today);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (plan != null) ...[
        _weekCard(context, plan),
        const SizedBox(height: 12),
        _weekStats(plan),
        ..._missed(plan),
        if (recoveries.isNotEmpty) ...[
          const SizedBox(height: 12),
          _recoveryCard(context, recoveries),
        ],
      ],
      const SizedBox(height: 24),
      const TrainingEyebrow('Muy pronto en tu app'),
      const SizedBox(height: 10),
      const ComingSoonCard(
          icon: Icons.monitor_weight_outlined,
          title: 'Check-in diario y peso',
          description:
              'Registra tu peso corporal, sueño, energía y estrés, y mira tu tendencia.'),
      const ComingSoonCard(
          icon: Icons.restaurant_outlined,
          title: 'Alimentación de hoy',
          description:
              'Tus comidas, cantidades e indicaciones del plan de tu profesional.'),
      const ComingSoonCard(
          icon: Icons.straighten_outlined,
          title: 'Evaluaciones',
          description:
              'Medidas y composición corporal registradas por tu profesional.'),
    ]);
  }

  Widget _weekCard(BuildContext context, TrainingPlan plan) {
    final colors = Theme.of(context).colorScheme;
    final monday = shiftDate(mondayOf(data.today), _week * 7);
    final selected = _selected ?? data.today;
    final title = switch (_week) {
      0 => 'Esta semana',
      -1 => 'Semana pasada',
      1 => 'Próxima semana',
      _ => 'Semana del ${shortDate(monday)}',
    };
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 14),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    IconButton(
                        tooltip: 'Semana anterior',
                        onPressed:
                            _week <= -12 ? null : () => setState(() => _week--),
                        icon: const Icon(Icons.chevron_left)),
                    Expanded(
                        child: Text(title,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: colors.onSurfaceVariant))),
                    IconButton(
                        tooltip: 'Semana siguiente',
                        onPressed:
                            _week >= 4 ? null : () => setState(() => _week++),
                        icon: const Icon(Icons.chevron_right)),
                  ]),
                  Row(children: [
                    for (var i = 0; i < 7; i++)
                      Expanded(
                          child: _weekCell(context, plan, shiftDate(monday, i),
                              i, selected)),
                  ]),
                  const SizedBox(height: 12),
                  Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: _dayPanel(context, plan, selected)),
                ])));
  }

  Widget _weekCell(BuildContext context, TrainingPlan plan, String date, int i,
      String selected) {
    final colors = Theme.of(context).colorScheme;
    final day = plan.dayFor(date);
    final current = date == data.today, chosen = date == selected;
    final logged = history?.on(date);
    final done = logged != null && sessionPerformed(logged) > 0;
    final status = done
        ? 'entrenamiento registrado'
        : day == null
            ? 'sin programación'
            : day.kind == 'rest'
                ? 'descanso'
                : day.name;
    return Semantics(
        button: true,
        selected: chosen,
        label: '${longDate(date)}${current ? ', hoy' : ''}: $status',
        child: ExcludeSemantics(
            child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => setState(() => _selected = date),
                child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(children: [
                      Text(weekdayInitials[i],
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: colors.onSurfaceVariant)),
                      const SizedBox(height: 6),
                      Container(
                          width: 38,
                          height: 38,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: chosen ? colors.primary : null,
                              border: current && !chosen
                                  ? Border.all(color: colors.primary, width: 2)
                                  : null),
                          child: FittedBox(
                              child: Text('${trainingDate(date).day}',
                                  style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w800,
                                      color: chosen
                                          ? colors.onPrimary
                                          : colors.onSurface)))),
                      const SizedBox(height: 4),
                      SizedBox(
                          height: 12,
                          child: done
                              ? const Icon(Icons.check_circle,
                                  size: 12, color: BrandColors.success)
                              : day?.kind == 'training'
                                  ? Center(
                                      child: Container(
                                          width: 6,
                                          height: 6,
                                          decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: colors.onSurfaceVariant
                                                  .withValues(alpha: .6))))
                                  : null),
                    ])))));
  }

  Widget _dayPanel(BuildContext context, TrainingPlan plan, String date) {
    final colors = Theme.of(context).colorScheme;
    final day = plan.dayFor(date);
    final session = history?.on(date);
    final training = day?.kind == 'training';
    final distance =
        trainingDate(data.today).difference(trainingDate(date)).inDays;
    final loggable =
        training && data.canWrite && distance >= 0 && distance <= 2;
    final label = date == data.today
        ? 'Hoy'
        : distance == 1
            ? 'Ayer'
            : distance == -1
                ? 'Mañana'
                : capitalized('${weekdayName(date)} ${trainingDate(date).day}');
    final groups = training ? dayGroups(day!) : const <String>[];
    return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: colors.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(16)),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    gradient: training ? BrandColors.gradient : null,
                    color: training ? null : colors.surface,
                    borderRadius: BorderRadius.circular(12)),
                child: Icon(
                    day?.kind == 'rest'
                        ? Icons.bedtime_outlined
                        : day == null
                            ? Icons.event_busy_outlined
                            : Icons.fitness_center,
                    color: training ? Colors.white : colors.onSurfaceVariant)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  TrainingEyebrow(label),
                  Text(
                      day?.kind == 'rest'
                          ? 'Día de descanso'
                          : day?.name ?? 'Sin entrenamiento',
                      style: const TextStyle(
                          fontSize: 19, fontWeight: FontWeight.w800)),
                  Text(
                      training
                          ? '${trainingCount(day!.exercises.length, 'ejercicio', 'ejercicios')} · ${trainingCount(day.setCount, 'serie', 'series')}'
                          : day?.kind == 'rest'
                              ? 'Recuperar también es parte del plan.'
                              : 'No hay nada programado.',
                      style: TextStyle(color: colors.onSurfaceVariant)),
                ])),
            if (session?.status == 'finalized')
              const Icon(Icons.check_circle,
                  color: BrandColors.success, semanticLabel: 'Registrado'),
          ]),
          if (groups.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final g in groups.take(4))
                TrainingChip(g, icon: Icons.accessibility_new),
            ]),
          ],
          if (training) ...[
            const SizedBox(height: 12),
            if (loggable)
              GradientActionButton(
                  label: session == null
                      ? 'Empezar entrenamiento'
                      : session.status == 'draft'
                          ? 'Continuar entrenamiento'
                          : 'Ver o corregir registro',
                  busy: widget.opening,
                  busyLabel: 'Abriendo…',
                  icon: Icons.play_arrow_rounded,
                  onPressed: widget.canLog ? () => widget.onStart(date) : null)
            else if (session != null)
              OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                          builder: (_) =>
                              SessionDetailScreen(session: session))),
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Ver lo que registraste'))
            else
              OutlinedButton.icon(
                  onPressed: () => widget.onShowDay(day!),
                  icon: const Icon(Icons.list_alt),
                  label: const Text('Ver ejercicios')),
          ],
        ]));
  }

  Widget _weekStats(TrainingPlan plan) {
    final monday = mondayOf(data.today);
    final week = [for (var i = 0; i < 7; i++) shiftDate(monday, i)];
    final planned =
        week.where((d) => plan.dayFor(d)?.kind == 'training').length;
    final h = history;
    final done = h == null
        ? null
        : week.where((d) {
            final s = h.on(d);
            return s != null && sessionPerformed(s) > 0;
          }).length;
    final streak = h == null ? null : TrainingStats(h, data.today).weekStreak;
    return Row(children: [
      Expanded(
          child: StatTile(
              icon: Icons.event_available_outlined,
              label: 'Esta semana',
              value: done == null ? '—' : '$done de $planned',
              highlight: done != null && planned > 0 && done >= planned)),
      const SizedBox(width: 10),
      Expanded(
          child: StatTile(
              icon: Icons.local_fire_department_outlined,
              label: 'Racha semanal',
              value: streak == null
                  ? '—'
                  : trainingCount(streak, 'semana', 'semanas'),
              highlight: (streak ?? 0) > 1)),
    ]);
  }

  Widget _recoveryCard(BuildContext context, List<GroupRecovery> items) {
    final colors = Theme.of(context).colorScheme;
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    Expanded(
                        child: Text('Recuperación muscular',
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: colors.onSurfaceVariant))),
                    Flexible(
                        child: TextButton(
                            onPressed: widget.onOpenProgress,
                            child: const Text('Ver progreso'))),
                  ]),
                  Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            RecoveryBody(items: items, height: 200),
                            const SizedBox(height: 16),
                            ...recoveryRows(items, limit: 3),
                          ])),
                ])));
  }

  List<Widget> _missed(TrainingPlan plan) {
    if (!data.canWrite) return const [];
    final pending = [
      for (final offset in [1, 2])
        if (plan.dayFor(shiftDate(data.today, -offset))?.kind == 'training' &&
            history?.on(shiftDate(data.today, -offset))?.status != 'finalized')
          offset
    ];
    if (pending.isEmpty) return const [];
    return [
      const SizedBox(height: 24),
      const TrainingEyebrow('¿Olvidaste registrar?'),
      const SizedBox(height: 8),
      for (final offset in pending)
        Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
                enabled: widget.canLog,
                leading: const Icon(Icons.history),
                title: Text(
                    '${offset == 1 ? 'Ayer' : 'Anteayer'} · ${plan.dayFor(shiftDate(data.today, -offset))!.name}',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(
                    '${shortDate(shiftDate(data.today, -offset))} · ${history?.on(shiftDate(data.today, -offset)) == null ? 'Sin registrar' : 'En progreso'}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => widget.onStart(shiftDate(data.today, -offset)))),
    ];
  }
}

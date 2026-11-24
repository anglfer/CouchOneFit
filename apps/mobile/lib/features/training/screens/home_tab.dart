import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/adaptive_columns.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/icon_badge.dart';
import '../../../shared/widgets/journey_surface.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/sheet_parts.dart';
import '../../../shared/widgets/status_view.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import 'progress_tab.dart';
import 'training_views.dart';

/// Inicio: today's focus — schedule, workout hero, daily check-in & nutrition,
/// compact weekly consistency and recovery status.
class HomeTab extends StatefulWidget {
  const HomeTab(
      {super.key,
      required this.data,
      required this.history,
      required this.canLog,
      required this.opening,
      required this.onStart,
      required this.onShowDay,
      required this.onOpenProgress,
      this.dailySlot});
  final TrainingContext data;
  final TrainingHistory? history;
  final bool canLog, opening;
  final ValueChanged<String> onStart;
  final ValueChanged<TrainingDay> onShowDay;
  final VoidCallback onOpenProgress;
  final Widget? dailySlot;
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
      if (plan != null)
        AdaptiveColumns(primary: [
          _weekCard(context, plan)
        ], secondary: [
          if (widget.dailySlot != null) ...[
            widget.dailySlot!,
            const SizedBox(height: 14),
          ],
          _weekStats(context, plan),
          ..._missed(context, plan),
          if (recoveries.isNotEmpty) ...[
            const SizedBox(height: 12),
            _recoveryCard(context, recoveries),
          ],
        ])
      else ...[
        const StatusView(
            icon: Icons.event_note_outlined,
            title: 'Todavía no tienes una rutina asignada',
            message: 'Tu profesional la compartirá aquí cuando esté lista.'),
        if (widget.dailySlot != null) ...[
          const SizedBox(height: 14),
          widget.dailySlot!,
        ],
      ],
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
    final awayFromToday = _week != 0 || selected != data.today;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Card(
          margin: EdgeInsets.zero,
          child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      IconButton(
                          tooltip: 'Semana anterior',
                          onPressed: _week <= -12
                              ? null
                              : () => setState(() => _week--),
                          icon: const Icon(Icons.chevron_left)),
                      Expanded(
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                        Text(title,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: colors.onSurface)),
                        if (awayFromToday)
                          TextButton(
                              style: TextButton.styleFrom(
                                  minimumSize: const Size(48, 32),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10),
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                  textStyle: const TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700)),
                              onPressed: () => setState(() {
                                    _week = 0;
                                    _selected = data.today;
                                  }),
                              child: const Text('Volver a hoy')),
                      ])),
                      IconButton(
                          tooltip: 'Semana siguiente',
                          onPressed:
                              _week >= 4 ? null : () => setState(() => _week++),
                          icon: const Icon(Icons.chevron_right)),
                    ]),
                    const SizedBox(height: 6),
                    Row(children: [
                      for (var i = 0; i < 7; i++)
                        Expanded(
                            child: _weekCell(context, plan,
                                shiftDate(monday, i), i, selected)),
                    ]),
                    if (plan.days.where((d) => d.kind == 'training').length >
                        1) ...[
                      const SizedBox(height: 8),
                      Divider(height: 1, color: colors.outlineVariant),
                      const SizedBox(height: 4),
                      Center(
                          child: TextButton.icon(
                              style: TextButton.styleFrom(
                                  visualDensity: VisualDensity.compact),
                              onPressed: () => _pickPlanDay(context, plan),
                              icon: const Icon(Icons.swap_horiz_rounded,
                                  size: 18),
                              label: const Text('Ver otro día de tu rutina'))),
                    ],
                  ]))),
      const SizedBox(height: 14),
      _dayPanel(context, plan, selected),
    ]);
  }

  void _pickPlanDay(BuildContext context, TrainingPlan plan) {
    final monday = shiftDate(mondayOf(data.today), _week * 7);
    final dates = [for (var i = 0; i < 7; i++) shiftDate(monday, i)];
    showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (sheet) => SafeArea(
            child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SheetHeader('Días de esta semana',
                          subtitle:
                              'Selecciona un día para consultar sus ejercicios o iniciar sesión si corresponde.'),
                      for (final d in dates)
                        SheetOption(
                            selected: d == (_selected ?? data.today),
                            leading: IconBadge(
                                plan.dayFor(d)?.kind == 'training'
                                    ? Icons.fitness_center
                                    : Icons.bedtime_outlined,
                                filled: plan.dayFor(d)?.kind == 'training',
                                tint: Theme.of(sheet)
                                    .colorScheme
                                    .onSurfaceVariant),
                            title: plan.dayFor(d)?.kind == 'rest'
                                ? 'Día de descanso'
                                : plan.dayFor(d)?.name ?? 'Sin entrenamiento',
                            subtitle:
                                '${capitalized(longDate(d))}${d == data.today ? ' · Hoy' : ''}',
                            onTap: () {
                              Navigator.pop(sheet);
                              setState(() => _selected = d);
                            }),
                    ]))));
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
    final disableAnim = MediaQuery.disableAnimationsOf(context);
    final ink = chosen
        ? Colors.white
        : day?.kind == 'rest' || day == null
            ? colors.onSurfaceVariant
            : colors.onSurface;
    return Semantics(
        button: true,
        selected: chosen,
        label: '${longDate(date)}${current ? ', hoy' : ''}: $status',
        onTap: () => setState(() => _selected = date),
        child: ExcludeSemantics(
            child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Material(
                    type: MaterialType.transparency,
                    child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: () => setState(() => _selected = date),
                        child: AnimatedContainer(
                            duration: disableAnim
                                ? Duration.zero
                                : const Duration(milliseconds: 180),
                            curve: Curves.easeOutCubic,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                                color: chosen
                                    ? actionFill(context)
                                    : day?.kind == 'training'
                                        ? colors.surfaceContainerHighest
                                            .withValues(alpha: 0.65)
                                        : null,
                                borderRadius: BorderRadius.circular(14),
                                border: current && !chosen
                                    ? Border.all(
                                        color: colors.primary, width: 1.5)
                                    : null),
                            child: Column(children: [
                              Text(weekdayInitials[i],
                                  style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                      color: chosen
                                          ? const Color(0xE6FFFFFF)
                                          : colors.onSurfaceVariant)),
                              const SizedBox(height: 4),
                              FittedBox(
                                  child: Text('${trainingDate(date).day}',
                                      style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w800,
                                          fontFeatures: const [
                                            FontFeature.tabularFigures()
                                          ],
                                          color: ink))),
                              const SizedBox(height: 3),
                              SizedBox(
                                  height: 12,
                                  child: done
                                      ? Icon(Icons.check_circle,
                                          size: 12,
                                          color: chosen
                                              ? Colors.white
                                              : statusInk(
                                                  context, BrandColors.success))
                                      : day?.kind == 'training'
                                          ? Center(
                                              child: Container(
                                                  width: 5,
                                                  height: 5,
                                                  decoration: BoxDecoration(
                                                      shape: BoxShape.circle,
                                                      color: chosen
                                                          ? Colors.white
                                                          : colors.secondary)))
                                          : null),
                            ])))))));
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
    if (!training) {
      return Card(
          margin: EdgeInsets.zero,
          child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                IconBadge(
                    day?.kind == 'rest'
                        ? Icons.bedtime_outlined
                        : Icons.event_busy_outlined,
                    size: 46,
                    tint: colors.onSurfaceVariant),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Row(children: [
                        Expanded(
                            child: Text(
                                '$label · ${day?.kind == 'rest' ? 'Día de descanso' : 'Sin entrenamiento'}',
                                style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800))),
                        if (day?.kind == 'rest') const TonePill('Descanso'),
                      ]),
                      const SizedBox(height: 3),
                      Text(
                          day?.kind == 'rest'
                              ? 'Recuperar también es parte del plan.'
                              : 'No hay nada programado.',
                          style: TextStyle(
                              fontSize: 13.5, color: colors.onSurfaceVariant)),
                    ])),
              ])));
    }
    Widget heroChip(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
            color: const Color(0x22FFFFFF),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: const Color(0x28FFFFFF))),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13.5, color: const Color(0xE6FFFFFF)),
          const SizedBox(width: 5),
          Flexible(
              child: Text(text,
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.white))),
        ]));
    return JourneySurface(
        child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                            color: const Color(0x2EFFFFFF),
                            borderRadius: BorderRadius.circular(99)),
                        child: Text(label,
                            style: const TextStyle(
                                fontSize: 12.5, fontWeight: FontWeight.w700))),
                    const Spacer(),
                    if (session?.status == 'finalized')
                      Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                              color: const Color(0x281FCC92),
                              borderRadius: BorderRadius.circular(99),
                              border:
                                  Border.all(color: const Color(0x551FCC92))),
                          child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check_circle,
                                    size: 14, color: BrandColors.success),
                                SizedBox(width: 5),
                                Text('Registrado',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white)),
                              ])),
                  ]),
                  const SizedBox(height: 14),
                  Text(day!.name,
                      style: const TextStyle(
                          fontSize: 30,
                          height: 1.1,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.6)),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    heroChip(
                        Icons.fitness_center_rounded,
                        trainingCount(
                            day.exercises.length, 'ejercicio', 'ejercicios')),
                    heroChip(Icons.repeat_rounded,
                        trainingCount(day.setCount, 'serie', 'series')),
                    if (groups.isNotEmpty)
                      heroChip(Icons.accessibility_new_rounded,
                          groups.take(3).join(' · ')),
                  ]),
                  const SizedBox(height: 18),
                  if (loggable)
                    GradientActionButton(
                        inverse: true,
                        label: session == null
                            ? 'Empezar entrenamiento'
                            : session.status == 'draft'
                                ? 'Continuar entrenamiento'
                                : 'Ver o corregir registro',
                        busy: widget.opening,
                        busyLabel: 'Abriendo…',
                        icon: Icons.play_arrow_rounded,
                        onPressed:
                            widget.canLog ? () => widget.onStart(date) : null)
                  else
                    OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Color(0x66FFFFFF))),
                        onPressed: session != null
                            ? () => Navigator.push(
                                context,
                                MaterialPageRoute<void>(
                                    builder: (_) =>
                                        SessionDetailScreen(session: session)))
                            : () => widget.onShowDay(day),
                        icon: Icon(session != null
                            ? Icons.receipt_long_outlined
                            : Icons.list_alt),
                        label: Text(session != null
                            ? 'Ver lo que registraste'
                            : 'Ver ejercicios')),
                ])));
  }

  Widget _weekStats(BuildContext context, TrainingPlan plan) {
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
    return StatPanel(tiles: [
      StatTile(
          icon: Icons.event_available_outlined,
          label: 'Esta semana',
          // Extra or pre-plan sessions made "3 de 1"; past the plan, count them.
          value: done == null
              ? '—'
              : done > planned
                  ? trainingCount(done, 'entreno', 'entrenos')
                  : '$done de $planned',
          progress: done != null && planned > 0
              ? (done / planned).clamp(0.0, 1.0)
              : null,
          highlight: done != null && planned > 0 && done >= planned),
      StatTile(
          icon: Icons.local_fire_department_outlined,
          label: 'Racha semanal',
          value:
              streak == null ? '—' : trainingCount(streak, 'semana', 'semanas'),
          highlight: (streak ?? 0) > 1),
    ]);
  }

  Widget _recoveryCard(BuildContext context, List<GroupRecovery> items) {
    final colors = Theme.of(context).colorScheme;
    final average =
        (items.fold<double>(0, (sum, r) => sum + r.ratio) / items.length * 100)
            .round();
    final avgTone = average >= 90
        ? BrandColors.success
        : average >= 50
            ? BrandColors.warning
            : BrandColors.highlight;
    return Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
            onTap: widget.onOpenProgress,
            child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 12, 16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CardTitle(
                          icon: Icons.self_improvement_rounded,
                          title: 'Recuperación muscular',
                          action: 'Ver progreso',
                          onAction: widget.onOpenProgress),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                            child: Text('General · $average %',
                                style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w800,
                                    fontFeatures: [
                                      FontFeature.tabularFigures()
                                    ]))),
                        Text(
                            average >= 90
                                ? 'Óptima'
                                : average >= 50
                                    ? 'En curso'
                                    : 'Cargada',
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: statusInk(context, avgTone))),
                      ]),
                      const SizedBox(height: 6),
                      ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                              minHeight: 6,
                              value: (average / 100).clamp(0.0, 1.0),
                              color: avgTone,
                              backgroundColor: colors.surfaceContainerHighest)),
                      const SizedBox(height: 10),
                      Wrap(spacing: 8, runSpacing: 6, children: [
                        for (final r in items.take(3))
                          TonePill('${r.group} · ${(r.ratio * 100).round()} %',
                              tone: r.ratio >= 1
                                  ? BrandColors.success
                                  : r.ratio >= .5
                                      ? BrandColors.warning
                                      : BrandColors.highlight),
                      ]),
                    ]))));
  }

  List<Widget> _missed(BuildContext context, TrainingPlan plan) {
    if (!data.canWrite) return const [];
    final pending = [
      for (final offset in [1, 2])
        if (plan.dayFor(shiftDate(data.today, -offset))?.kind == 'training' &&
            history?.on(shiftDate(data.today, -offset))?.status != 'finalized')
          offset
    ];
    if (pending.isEmpty) return const [];
    return [
      const SizedBox(height: 20),
      const SectionTitle('¿Olvidaste registrar?'),
      const SizedBox(height: 10),
      GroupCard(indent: 68, children: [
        for (final offset in pending)
          ListTile(
              enabled: widget.canLog,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              leading: const IconBadge(Icons.history,
                  tint: BrandColors.warning, size: 40),
              title: Text(
                  '${offset == 1 ? 'Ayer' : 'Anteayer'} · ${plan.dayFor(shiftDate(data.today, -offset))!.name}'),
              subtitle: Text(
                  '${shortDate(shiftDate(data.today, -offset))} · ${history?.on(shiftDate(data.today, -offset)) == null ? 'Sin registrar' : 'En progreso'}'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => widget.onStart(shiftDate(data.today, -offset))),
      ]),
    ];
  }
}

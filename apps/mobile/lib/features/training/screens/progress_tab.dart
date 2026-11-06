import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/coming_soon_card.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import '../services/training_service.dart';
import '../widgets/muscle_map.dart';
import 'training_views.dart';

/// Progreso: own log turned into numbers, activity, muscle balance,
/// estimated recovery, strength trends and recent sessions.
class ProgressTab extends StatefulWidget {
  const ProgressTab(
      {super.key,
      required this.history,
      required this.failed,
      required this.today,
      required this.onRetry,
      this.service});
  final TrainingHistory? history;
  final bool failed;
  final String today;
  final VoidCallback onRetry;

  /// Lets the full history screen load more pages.
  final TrainingService? service;
  @override
  State<ProgressTab> createState() => _ProgressTabState();
}

enum _Analysis { balance, recovery, strength }

enum _ProgressSection { overview, muscles, lifts, sessions }

class _ProgressTabState extends State<ProgressTab> {
  bool _volume = false;
  bool _showAllMuscles = false;
  _Analysis _analysis = _Analysis.balance;
  _ProgressSection _section = _ProgressSection.overview;
  int _period = 7;

  @override
  Widget build(BuildContext context) {
    final h = widget.history;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (h == null && widget.failed) ...[
        const TrainingNotice(
            error: true,
            text: 'No pudimos consultar tu historial. Revisa tu conexión.'),
        Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
                onPressed: widget.onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'))),
      ] else if (h == null)
        const Center(
            child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator()))
      else
        ..._content(context, h),
      const SizedBox(height: 24),
      const TrainingEyebrow('Muy pronto'),
      const SizedBox(height: 10),
      const ComingSoonRow(cards: [
        ComingSoonCard(
            icon: Icons.monitor_weight_outlined,
            title: 'Peso corporal',
            description:
                'Tu tendencia de peso con lo que registres en el check-in diario.'),
        ComingSoonCard(
            icon: Icons.straighten_outlined,
            title: 'Medidas y evaluaciones',
            description:
                'Tu evolución de medidas cuando tu profesional registre evaluaciones.'),
      ]),
    ]);
  }

  List<Widget> _content(BuildContext context, TrainingHistory h) {
    final stats = TrainingStats(h, widget.today);
    final exercises = exerciseProgress(h);
    final showOverview = _section == _ProgressSection.overview;
    return [
      ChoiceBar<_ProgressSection>(options: const [
        (_ProgressSection.overview, 'Resumen'),
        (_ProgressSection.muscles, 'Músculos'),
        (_ProgressSection.lifts, 'Ejercicios'),
        (_ProgressSection.sessions, 'Sesiones'),
      ], selected: _section, onChanged: (v) => setState(() => _section = v)),
      const SizedBox(height: 14),
      if (showOverview) ...[
        Row(children: [
          Expanded(
              child: StatTile(
                  icon: Icons.fitness_center,
                  label: 'Entrenamientos',
                  value: '${stats.total}')),
          const SizedBox(width: 10),
          Expanded(
              child: StatTile(
                  icon: Icons.calendar_month_outlined,
                  label: 'Este mes',
                  value: '${stats.thisMonth}')),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
              child: StatTile(
                  icon: Icons.local_fire_department_outlined,
                  label: 'Racha semanal',
                  value: trainingCount(stats.weekStreak, 'semana', 'semanas'),
                  highlight: stats.weekStreak > 1)),
          const SizedBox(width: 10),
          Expanded(
              child: StatTile(
                  icon: Icons.repeat,
                  label: 'Series hechas',
                  value: trainingThousands(
                      h.sessions.fold(0, (t, s) => t + sessionPerformed(s))))),
        ]),
        const SizedBox(height: 10),
        StatTile(
            icon: Icons.emoji_events_outlined,
            label: 'Levantado en total',
            value: '${trainingThousands(stats.volume)} kg'),
        const SizedBox(height: 12),
        _activity(context, h),
      ],
      if (h.sessions.isEmpty) ...[
        const SizedBox(height: 12),
        const TrainingNotice(
            icon: Icons.insights_outlined,
            text:
                'Aún no hay entrenamientos registrados. Cuando registres tu primera sesión verás aquí tu progreso.'),
      ] else if (showOverview || _section == _ProgressSection.muscles) ...[
        if (showOverview) const SizedBox(height: 12),
        _analysisCard(context, h, exercises),
      ],
      if (exercises.isNotEmpty &&
          (showOverview || _section == _ProgressSection.lifts)) ...[
        SizedBox(height: showOverview ? 24 : 4),
        const TrainingEyebrow('Tus ejercicios'),
        const SizedBox(height: 8),
        for (final e in exercises.take(showOverview ? 4 : exercises.length))
          _exerciseRow(context, e),
        if (showOverview && exercises.length > 4)
          TextButton.icon(
              onPressed: () =>
                  setState(() => _section = _ProgressSection.lifts),
              icon: const Icon(Icons.fitness_center, size: 18),
              label: Text('Ver los ${exercises.length} ejercicios')),
      ] else if (_section == _ProgressSection.lifts &&
          h.sessions.isNotEmpty) ...[
        const TrainingNotice(
            icon: Icons.fitness_center,
            text:
                'Registra series completadas para ver el avance por ejercicio.'),
      ],
      if (h.sessions.isNotEmpty &&
          (showOverview || _section == _ProgressSection.sessions)) ...[
        SizedBox(height: showOverview ? 24 : 4),
        const TrainingEyebrow('Últimas sesiones'),
        const SizedBox(height: 8),
        for (final s in h.sessions.take(showOverview ? 3 : 10))
          SessionRow(session: s),
        TextButton.icon(
            onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                    builder: (_) =>
                        HistoryScreen(initial: h, service: widget.service))),
            icon: const Icon(Icons.history),
            label: const Text('Ver todo el historial')),
      ],
    ];
  }

  /// 17 weeks, Monday-first columns, four intensity levels.
  Widget _activity(BuildContext context, TrainingHistory h) {
    final colors = Theme.of(context).colorScheme;
    const weeks = 17;
    final first = shiftDate(mondayOf(widget.today), -7 * (weeks - 1));
    final values = [
      for (var i = 0; i < weeks * 7; i++)
        activityValue(h.on(shiftDate(first, i)), volume: _volume)
    ];
    final max = values.fold<double>(0, (a, b) => a > b ? a : b);
    Color level(double v) => v == 0
        ? colors.surfaceContainerHighest
        : colors.primary.withValues(
            alpha: [.3, .55, .8, 1.0][((v / max) * 4).ceil().clamp(1, 4) - 1]);
    final trained = values.where((v) => v > 0).length;
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Actividad · últimos 4 meses',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: colors.onSurfaceVariant)),
                  const SizedBox(height: 10),
                  ChoiceBar<bool>(
                      options: const [(false, 'Series'), (true, 'Volumen')],
                      selected: _volume,
                      onChanged: (v) => setState(() => _volume = v)),
                  const SizedBox(height: 12),
                  Semantics(
                      label:
                          '${trainingCount(trained, 'día entrenado', 'días entrenados')} en los últimos 4 meses',
                      child: ExcludeSemantics(
                          child: LayoutBuilder(builder: (context, c) {
                        final size = ((c.maxWidth - (weeks - 1) * 3) / weeks)
                            .clamp(6.0, 18.0);
                        return Column(children: [
                          Row(children: [
                            for (var w = 0; w < weeks; w++)
                              Container(
                                  width: size,
                                  height: 16,
                                  margin: EdgeInsets.only(left: w == 0 ? 0 : 3),
                                  child: OverflowBox(
                                      maxWidth: 40,
                                      alignment: Alignment.centerLeft,
                                      child: Text(
                                          w == 0 ||
                                                  trainingDate(shiftDate(
                                                              first, w * 7))
                                                          .month !=
                                                      trainingDate(shiftDate(
                                                              first,
                                                              (w - 1) * 7))
                                                          .month
                                              ? shortDate(
                                                      shiftDate(first, w * 7))
                                                  .split(' ')
                                                  .last
                                              : '',
                                          style: TextStyle(
                                              fontSize: 11,
                                              color:
                                                  colors.onSurfaceVariant)))),
                          ]),
                          const SizedBox(height: 4),
                          Row(children: [
                            for (var w = 0; w < weeks; w++)
                              Padding(
                                  padding:
                                      EdgeInsets.only(left: w == 0 ? 0 : 3),
                                  child: Column(children: [
                                    for (var d = 0; d < 7; d++)
                                      Builder(builder: (context) {
                                        final date =
                                            shiftDate(first, w * 7 + d);
                                        final future =
                                            date.compareTo(widget.today) > 0;
                                        return Container(
                                            width: size,
                                            height: size,
                                            margin: const EdgeInsets.only(
                                                bottom: 3),
                                            decoration: BoxDecoration(
                                                color: future
                                                    ? Colors.transparent
                                                    : level(values[w * 7 + d]),
                                                border: date == widget.today
                                                    ? Border.all(
                                                        color: colors.primary,
                                                        width: 1.5)
                                                    : null,
                                                borderRadius:
                                                    BorderRadius.circular(3)));
                                      }),
                                  ])),
                          ]),
                        ]);
                      }))),
                  const SizedBox(height: 6),
                  Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Text('Menos',
                        style: TextStyle(
                            fontSize: 12, color: colors.onSurfaceVariant)),
                    for (final a in [.0, .3, .55, .8, 1.0])
                      Container(
                          width: 10,
                          height: 10,
                          margin: const EdgeInsets.only(left: 3),
                          decoration: BoxDecoration(
                              color: a == 0
                                  ? colors.surfaceContainerHighest
                                  : colors.primary.withValues(alpha: a),
                              borderRadius: BorderRadius.circular(3))),
                    const SizedBox(width: 4),
                    Text('Más',
                        style: TextStyle(
                            fontSize: 12, color: colors.onSurfaceVariant)),
                  ]),
                ])));
  }

  Widget _analysisCard(BuildContext context, TrainingHistory h,
      List<ExerciseProgress> exercises) {
    final colors = Theme.of(context).colorScheme;
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ChoiceBar<_Analysis>(
                      options: const [
                        (_Analysis.balance, 'Balance'),
                        (_Analysis.recovery, 'Recuperación'),
                        (_Analysis.strength, 'Fuerza'),
                      ],
                      selected: _analysis,
                      onChanged: (v) => setState(() => _analysis = v)),
                  const SizedBox(height: 14),
                  ...switch (_analysis) {
                    _Analysis.balance => _balance(context, h),
                    _Analysis.recovery => [
                        Text('Recuperación estimada por grupo muscular',
                            style: TextStyle(color: colors.onSurfaceVariant)),
                        const SizedBox(height: 12),
                        RecoveryBody(items: recovery(h, widget.today)),
                        const SizedBox(height: 16),
                        ...recoveryRows(recovery(h, widget.today)),
                      ],
                    _Analysis.strength => _strength(context, exercises),
                  },
                ])));
  }

  List<Widget> _balance(BuildContext context, TrainingHistory h) {
    final colors = Theme.of(context).colorScheme;
    final since = switch (_period) {
      7 => mondayOf(widget.today),
      0 => null,
      _ => shiftDate(widget.today, 1 - _period),
    };
    final groups = setsByGroup(h, since: since);
    final max = groups.isEmpty ? 1 : groups.first.value;
    final visibleGroups = _showAllMuscles || groups.length <= 6
        ? groups
        : groups.take(6).toList();
    return [
      Text('Series por grupo muscular',
          style: TextStyle(color: colors.onSurfaceVariant)),
      const SizedBox(height: 8),
      ChoiceBar<int>(options: const [
        (7, 'Semana'),
        (30, '30 d'),
        (90, '90 d'),
        (0, 'Todo')
      ], selected: _period, onChanged: (v) => setState(() => _period = v)),
      const SizedBox(height: 12),
      if (groups.isEmpty)
        Text('Sin series con grupo muscular en este periodo.',
            style: TextStyle(color: colors.onSurfaceVariant))
      else ...[
        MuscleMap(
            height: 260,
            fill: {
              for (final g in groups)
                g.key:
                    colors.primary.withValues(alpha: .35 + .65 * g.value / max)
            },
            semanticsLabel:
                'Series entrenadas: ${groups.map((g) => '${g.key} ${g.value}').join(', ')}'),
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          Text('Menos',
              style: TextStyle(fontSize: 11.5, color: colors.onSurfaceVariant)),
          for (final a in [.0, .35, .6, .82, 1.0])
            Container(
                width: 9,
                height: 9,
                margin: const EdgeInsets.only(left: 3),
                decoration: BoxDecoration(
                    color: a == 0
                        ? colors.surfaceContainerHighest
                        : colors.primary.withValues(alpha: a),
                    borderRadius: BorderRadius.circular(2.5))),
          const SizedBox(width: 4),
          Text('Más',
              style: TextStyle(fontSize: 11.5, color: colors.onSurfaceVariant)),
        ]),
        const SizedBox(height: 10),
        for (final g in visibleGroups)
          Semantics(
              label: '${g.key}: ${trainingCount(g.value, 'serie', 'series')}',
              child: ExcludeSemantics(
                  child: Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: LayoutBuilder(builder: (context, c) {
                        final stacked = c.maxWidth < 260 ||
                            MediaQuery.textScalerOf(context).scale(14) > 19;
                        if (stacked) {
                          return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(children: [
                                  Expanded(
                                      child: Text(g.key,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600))),
                                  Text('${g.value}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700)),
                                ]),
                                const SizedBox(height: 5),
                                ClipRRect(
                                    borderRadius: BorderRadius.circular(99),
                                    child: LinearProgressIndicator(
                                        minHeight: 9,
                                        value: g.value / max,
                                        backgroundColor:
                                            colors.surfaceContainerHighest)),
                              ]);
                        }
                        return Row(children: [
                          SizedBox(
                              width: 104,
                              child: Text(g.key,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600))),
                          Expanded(
                              child: ClipRRect(
                                  borderRadius: BorderRadius.circular(99),
                                  child: LinearProgressIndicator(
                                      minHeight: 10,
                                      value: g.value / max,
                                      backgroundColor:
                                          colors.surfaceContainerHighest))),
                          SizedBox(
                              width: 36,
                              child: Text('${g.value}',
                                  textAlign: TextAlign.end,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700))),
                        ]);
                      })))),
        if (groups.length > 6)
          Align(
              alignment: Alignment.center,
              child: TextButton.icon(
                  onPressed: () =>
                      setState(() => _showAllMuscles = !_showAllMuscles),
                  icon: Icon(_showAllMuscles
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded),
                  label: Text(_showAllMuscles
                      ? 'Mostrar menos'
                      : 'Mostrar más (${groups.length - 6})'))),
      ],
      Text(
          'Cuenta las series hechas de cada ejercicio en sus músculos principales.',
          style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
    ];
  }

  List<Widget> _strength(BuildContext context, List<ExerciseProgress> all) {
    final colors = Theme.of(context).colorScheme;
    final loaded = [
      for (final e in all)
        if (!e.bodyweight && e.estimates.isNotEmpty) e
    ];
    return [
      Text('1RM estimado (fórmula de Epley) por ejercicio',
          style: TextStyle(color: colors.onSurfaceVariant)),
      const SizedBox(height: 8),
      if (loaded.isEmpty)
        Text('Registra ejercicios con carga para ver tu fuerza estimada.',
            style: TextStyle(color: colors.onSurfaceVariant))
      else
        for (final e in loaded.take(6))
          Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(e.name,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                          '${trainingDecimal(e.estimates.last.roundToDouble())} kg${e.estimates.length > 1 ? ' · ${_percent(e.estimates.first, e.estimates.last)}' : ''}',
                          style: TextStyle(color: colors.onSurfaceVariant)),
                    ])),
                if (e.estimates.length > 1)
                  SizedBox(
                      width: 80,
                      child: TrendChart(
                          values: e.estimates,
                          label:
                              '${e.name}: 1RM estimado de ${e.estimates.first.round()} a ${e.estimates.last.round()} kg')),
              ])),
      Text('Orientativo: estima tu máximo a partir de kg y reps registrados.',
          style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
    ];
  }

  String _percent(double from, double to) {
    final p = from == 0 ? 0 : ((to - from) / from * 100).round();
    return '${p > 0 ? '+' : p < 0 ? '−' : ''}${p.abs()} % desde el inicio';
  }

  Widget _exerciseRow(BuildContext context, ExerciseProgress e) {
    final colors = Theme.of(context).colorScheme;
    final change = e.change;
    return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                    builder: (_) => ExerciseProgressScreen(progress: e))),
            child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(children: [
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(e.name,
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                            'Mejor: ${e.format(e.best)} · ${trainingCount(e.points.length, 'sesión', 'sesiones')}',
                            style: TextStyle(color: colors.onSurfaceVariant)),
                        if (e.points.length > 1)
                          Row(children: [
                            Icon(
                                change > 0
                                    ? Icons.trending_up
                                    : change < 0
                                        ? Icons.trending_down
                                        : Icons.trending_flat,
                                size: 18,
                                color: change > 0
                                    ? BrandColors.success
                                    : colors.onSurfaceVariant),
                            const SizedBox(width: 4),
                            Flexible(
                                child: Text(
                                    change == 0
                                        ? 'Estable desde el inicio'
                                        : '${change > 0 ? '+' : '−'}${e.format(change.abs())} desde el inicio',
                                    style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: change > 0
                                            ? BrandColors.success
                                            : colors.onSurfaceVariant))),
                          ]),
                      ])),
                  if (e.points.length > 1) ...[
                    const SizedBox(width: 12),
                    SizedBox(
                        width: 72,
                        child: TrendChart(
                            values: e.values,
                            label:
                                'Tendencia de ${e.name}: de ${e.format(e.values.first)} a ${e.format(e.values.last)}')),
                  ],
                  Icon(Icons.chevron_right, color: colors.onSurfaceVariant),
                ]))));
  }
}

/// Recovery bars shared by Inicio and Progreso.
List<Widget> recoveryRows(List<GroupRecovery> items, {int? limit}) => [
      if (items.isEmpty)
        const Text('Registra series de ejercicios del catálogo para verla.')
      else
        for (final r in items.take(limit ?? items.length)) _RecoveryRow(r),
      Builder(
          builder: (context) => Text(
              'Estimación orientativa según tus series registradas; no sustituye la indicación de tu profesional.',
              style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant))),
    ];

class _RecoveryRow extends StatelessWidget {
  const _RecoveryRow(this.r);
  final GroupRecovery r;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final color = r.ratio >= 1
        ? BrandColors.success
        : r.ratio >= .5
            ? BrandColors.warning
            : BrandColors.highlight;
    final when = r.daysAgo == 0
        ? 'hoy'
        : r.daysAgo == 1
            ? 'ayer'
            : 'hace ${r.daysAgo} días';
    return Semantics(
        label:
            '${r.group}: ${r.status}, ${(r.ratio * 100).round()} %. Entrenado $when, ${trainingCount(r.sets, 'serie', 'series')}',
        child: ExcludeSemantics(
            child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(children: [
                        Expanded(
                            child: Text(r.group,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700))),
                        Icon(
                            r.ratio >= 1
                                ? Icons.check_circle
                                : Icons.hourglass_bottom,
                            size: 16,
                            color: color),
                        const SizedBox(width: 4),
                        Flexible(
                            child: Text(
                                '${r.status} · ${(r.ratio * 100).round()} %',
                                textAlign: TextAlign.end,
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: colors.onSurface))),
                      ]),
                      const SizedBox(height: 6),
                      ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                              minHeight: 8,
                              value: r.ratio,
                              color: color,
                              backgroundColor: colors.surfaceContainerHighest)),
                      const SizedBox(height: 4),
                      Text(
                          'Entrenado $when · ${trainingCount(r.sets, 'serie', 'series')}',
                          style: TextStyle(
                              fontSize: 12, color: colors.onSurfaceVariant)),
                    ]))));
  }
}

class SessionRow extends StatelessWidget {
  const SessionRow({super.key, required this.session});
  final HistorySession session;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final s = session;
    final finalized = s.status == 'finalized';
    return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: Icon(
                finalized ? Icons.check_circle : Icons.timelapse_outlined,
                color:
                    finalized ? BrandColors.success : colors.onSurfaceVariant,
                semanticLabel: finalized ? 'Finalizado' : 'En progreso'),
            title: Text(s.dayName,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(
                '${capitalized(longDate(s.localDate))}\n${trainingCount(sessionPerformed(s), 'serie', 'series')} · ${trainingThousands(sessionVolume(s))} kg'),
            isThreeLine: true,
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                    builder: (_) => SessionDetailScreen(session: s)))));
  }
}

/// Full own history with paging.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, required this.initial, this.service});
  final TrainingHistory initial;
  final TrainingService? service;
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late TrainingHistory _history = widget.initial;
  bool _loading = false;
  Future<void> _more() async {
    setState(() => _loading = true);
    try {
      final next = await widget.service!.history(offset: _history.nextOffset!);
      if (mounted) {
        setState(() => _history = TrainingHistory.merged(_history, next));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('No pudimos cargar más sesiones. Reintenta.')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Historial')),
      body: SafeArea(
          child: ListView(padding: const EdgeInsets.all(16), children: [
        Center(
            child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_history.sessions.isEmpty)
                        const TrainingNotice(
                            text: 'Aún no hay entrenamientos registrados.'),
                      for (final s in _history.sessions) SessionRow(session: s),
                      if (_history.nextOffset != null && widget.service != null)
                        OutlinedButton(
                            onPressed: _loading ? null : _more,
                            child: Text(
                                _loading ? 'Cargando…' : 'Ver más sesiones')),
                    ])))
      ])));
}

class ExerciseProgressScreen extends StatelessWidget {
  const ExerciseProgressScreen({super.key, required this.progress});
  final ExerciseProgress progress;
  @override
  Widget build(BuildContext context) {
    final e = progress;
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
        appBar: AppBar(title: Text(e.name)),
        body: SafeArea(
            child: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(children: [
                          Expanded(
                              child: StatTile(
                                  icon: Icons.emoji_events_outlined,
                                  label: 'Mejor marca',
                                  value: e.format(e.best),
                                  highlight: true)),
                          const SizedBox(width: 10),
                          Expanded(
                              child: StatTile(
                                  icon: Icons.history,
                                  label: 'Última vez',
                                  value: e.format(e.values.last))),
                        ]),
                        if (e.estimates.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          StatTile(
                              icon: Icons.bolt_outlined,
                              label: '1RM estimado (última sesión)',
                              value: '${e.estimates.last.round()} kg'),
                        ],
                        const SizedBox(height: 12),
                        Card(
                            margin: EdgeInsets.zero,
                            child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                          e.bodyweight
                                              ? 'Mejores repeticiones por sesión'
                                              : 'Mayor carga por sesión (kg)',
                                          style: TextStyle(
                                              fontWeight: FontWeight.w700,
                                              color: colors.onSurfaceVariant)),
                                      const SizedBox(height: 12),
                                      TrendChart(
                                          values: e.values,
                                          axis: true,
                                          height: 160,
                                          label:
                                              '${e.name}: ${e.points.length} sesiones, de ${e.format(e.values.first)} a ${e.format(e.values.last)}'),
                                      const SizedBox(height: 6),
                                      Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(shortDate(e.points.first.date),
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    color: colors
                                                        .onSurfaceVariant)),
                                            Text(shortDate(e.points.last.date),
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    color: colors
                                                        .onSurfaceVariant)),
                                          ]),
                                    ]))),
                        const SizedBox(height: 24),
                        const TrainingEyebrow('Sesiones'),
                        const SizedBox(height: 8),
                        for (final p in e.points.reversed)
                          Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                  title: Text(capitalized(longDate(p.date)),
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700)),
                                  subtitle: Text(p.exercise.sets
                                      .whereType<SetResult>()
                                      .map(setShort)
                                      .join(' · ')))),
                      ])))
        ])));
  }
}

class SessionDetailScreen extends StatelessWidget {
  const SessionDetailScreen({super.key, required this.session});
  final HistorySession session;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
        appBar: AppBar(
            title:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(session.dayName,
              style:
                  const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          Text(capitalized(longDate(session.localDate)),
              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
        ])),
        body: SafeArea(
            child: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          TrainingChip(
                              session.status == 'finalized'
                                  ? 'Finalizado'
                                  : 'En progreso',
                              icon: Icons.flag_outlined),
                          TrainingChip(
                              trainingCount(
                                  sessionPerformed(session), 'serie', 'series'),
                              icon: Icons.repeat),
                          TrainingChip(
                              '${trainingThousands(sessionVolume(session))} kg',
                              icon: Icons.bar_chart_rounded),
                        ]),
                        for (final e in session.exercises)
                          Card(
                              margin: const EdgeInsets.only(top: 12),
                              child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(e.name,
                                            style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w800)),
                                        for (final entry
                                            in e.sets.asMap().entries)
                                          Padding(
                                              padding:
                                                  const EdgeInsets.only(top: 8),
                                              child: Text(
                                                  'Serie ${entry.key + 1}: ${entry.value == null ? 'Pendiente' : setLabel(entry.value!)}',
                                                  style: TextStyle(
                                                      color: entry.value
                                                                  ?.state ==
                                                              'performed'
                                                          ? colors.onSurface
                                                          : colors
                                                              .onSurfaceVariant))),
                                      ]))),
                      ])))
        ])));
  }
}

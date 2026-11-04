import 'package:flutter/material.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../auth/models/session_models.dart';
import '../../client/models/client_profile.dart';
import '../models/training.dart';
import '../services/training_service.dart';
import 'training_views.dart';
import 'training_session_screen.dart';

class ClientShell extends StatefulWidget {
  const ClientShell(
      {super.key,
      required this.profile,
      required this.service,
      required this.account,
      required this.onThemeChanged});
  final ClientProfile profile;
  final TrainingService service;
  final Widget account;
  final ValueChanged<ThemeMode> onThemeChanged;
  @override
  State<ClientShell> createState() => _ClientShellState();
}

class _ClientShellState extends State<ClientShell> {
  int _selected = 0, _epoch = 0;
  TrainingContext? _data;
  DateTime? _cachedAt;
  String? _error;
  bool _loading = true, _opening = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final epoch = ++_epoch;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.service.context();
      if (!mounted || epoch != _epoch) return;
      if (data.clientId != widget.profile.id) {
        throw const FormatException('Cuenta distinta');
      }
      await widget.service.cache.save(widget.profile, data);
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _data = data;
        _cachedAt = null;
      });
    } catch (error) {
      if (TrainingService.denied(error)) await widget.service.cache.clear();
      final cached = TrainingService.disconnected(error)
          ? await widget.service.cache.read(clientId: widget.profile.id)
          : null;
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _data = cached?.context;
        _cachedAt = cached?.updatedAt;
        _error = cached != null
            ? null
            : error is AuthApiException
                ? error.message
                : 'No pudimos consultar tu rutina. Reintenta la consulta.';
      });
    } finally {
      if (mounted && epoch == _epoch) setState(() => _loading = false);
    }
  }

  Future<void> _openSession(String date) async {
    setState(() {
      _opening = true;
      _error = null;
    });
    try {
      final data = await widget.service.context(date: date);
      if (!mounted) return;
      if (data.clientId != widget.profile.id) {
        throw const FormatException('Cuenta distinta');
      }
      if (!data.canWrite) {
        throw const AuthApiException(
            statusCode: 403,
            code: 'READ_ONLY',
            message:
                'Tu rutina está disponible para consulta. Contacta a tu profesional para habilitar el registro.');
      }
      if (data.day == null || data.day!.kind == 'rest') {
        setState(() => _error = data.day == null
            ? 'No había entrenamiento programado para esa fecha.'
            : 'Esa fecha corresponde a un descanso.');
        return;
      }
      await Navigator.push<void>(
          context,
          MaterialPageRoute(
              builder: (_) => TrainingSessionScreen(
                  contextData: data, service: widget.service)));
      if (mounted) await _load();
    } catch (error) {
      if (TrainingService.denied(error)) await widget.service.cache.clear();
      if (mounted) {
        setState(() => _error = error is AuthApiException
            ? error.message
            : 'No pudimos abrir la sesión. Revisa tu conexión.');
      }
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  void _showDay(TrainingDay day) => Navigator.push(context,
      MaterialPageRoute<void>(builder: (_) => TrainingDayScreen(day: day)));

  void _showExercise(TrainingExercise exercise) => Navigator.push(
      context,
      MaterialPageRoute<void>(
          builder: (_) => ExerciseDetailScreen(exercise: exercise)));

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 768;
    final dark = Theme.of(context).brightness == Brightness.dark;
    const destinations = [
      NavigationDestination(
          icon: Icon(Icons.today_outlined),
          selectedIcon: Icon(Icons.today),
          label: 'Hoy'),
      NavigationDestination(
          icon: Icon(Icons.fitness_center_outlined),
          selectedIcon: Icon(Icons.fitness_center),
          label: 'Rutina'),
      NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Cuenta')
    ];
    return Scaffold(
        appBar: AppBar(
            title: const Text('CouchOne Fit',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            actions: [
              IconButton(
                  tooltip:
                      dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
                  icon: Icon(dark
                      ? Icons.light_mode_outlined
                      : Icons.dark_mode_outlined),
                  onPressed: () => widget
                      .onThemeChanged(dark ? ThemeMode.light : ThemeMode.dark)),
            ]),
        body: SafeArea(
            child: Row(children: [
          if (wide)
            NavigationRail(
                labelType: NavigationRailLabelType.all,
                selectedIndex: _selected,
                onDestinationSelected: (index) =>
                    setState(() => _selected = index),
                destinations: destinations
                    .map((d) => NavigationRailDestination(
                        icon: d.icon,
                        selectedIcon: d.selectedIcon,
                        label: Text(d.label)))
                    .toList()),
          Expanded(
              child: _selected == 2
                  ? widget.account
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: LayoutBuilder(builder: (context, constraints) {
                        final gutter = constraints.maxWidth < 360 ? 16.0 : 20.0;
                        return ListView(
                            padding:
                                EdgeInsets.fromLTRB(gutter, 16, gutter, 32),
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              Center(
                                  child: ConstrainedBox(
                                      constraints:
                                          const BoxConstraints(maxWidth: 560),
                                      child: _content()))
                            ]);
                      })))
        ])),
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: _selected,
                onDestinationSelected: (index) =>
                    setState(() => _selected = index),
                destinations: destinations));
  }

  Widget _content() {
    final data = _data, plan = data?.plan;
    final text = Theme.of(context).textTheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TrainingEyebrow(_selected == 0
          ? (data == null ? 'Hoy' : longDate(data.today))
          : 'Tu programación'),
      const SizedBox(height: 6),
      Semantics(
          header: true,
          child: Text(
              _selected == 0
                  ? 'Hola, ${widget.profile.fullName.split(' ').first}'
                  : 'Mi rutina',
              style: text.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800, letterSpacing: -0.6))),
      const SizedBox(height: 16),
      if (_loading && data == null)
        const Center(
            child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator()))
      else ...[
        if (_error != null) ...[
          TrainingNotice(text: _error!, error: true),
          Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                  onPressed: _loading ? null : _load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Reintentar'))),
        ],
        if (_cachedAt != null)
          TrainingNotice(
              icon: Icons.cloud_off_outlined,
              text:
                  'Lectura guardada · actualizada ${_cachedAt!.toLocal().toString().substring(0, 16)}. Conéctate para actualizar o registrar series.'),
        if (data != null && plan == null)
          const TrainingNotice(
              icon: Icons.event_note_outlined,
              text:
                  'Todavía no tienes una rutina asignada. Tu profesional la compartirá aquí cuando esté lista.'),
        if (data != null && plan != null && !data.canWrite)
          const TrainingNotice(
              text:
                  'Puedes consultar tu rutina. El registro está pausado por ahora.'),
        if (data != null && plan != null)
          ..._selected == 0 ? _today(data, plan) : _routine(plan),
      ],
    ]);
  }

  List<Widget> _today(TrainingContext data, TrainingPlan plan) {
    final day = data.day;
    final colors = Theme.of(context).colorScheme;
    final canLog = data.canWrite && _cachedAt == null && !_opening;
    final monday = shiftDate(data.today, 1 - trainingDate(data.today).weekday);
    return [
      Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                              color: colors.primaryContainer,
                              borderRadius: BorderRadius.circular(14)),
                          child: Icon(
                              day?.kind == 'rest'
                                  ? Icons.spa_outlined
                                  : day == null
                                      ? Icons.event_busy_outlined
                                      : Icons.fitness_center,
                              color: colors.onPrimaryContainer)),
                      const SizedBox(width: 14),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(
                                day?.kind == 'rest'
                                    ? 'Hoy toca descansar'
                                    : day?.name ?? 'Sin entrenamiento hoy',
                                style: const TextStyle(
                                    fontSize: 19, fontWeight: FontWeight.w800)),
                            Text(
                                day?.kind == 'training'
                                    ? '${trainingCount(day!.exercises.length, 'ejercicio', 'ejercicios')} · ${trainingCount(day.setCount, 'serie', 'series')}'
                                    : day?.kind == 'rest'
                                        ? 'El descanso también es parte del plan.'
                                        : 'No hay nada programado para esta fecha.',
                                style:
                                    TextStyle(color: colors.onSurfaceVariant)),
                          ])),
                    ]),
                    if (day?.kind == 'training') ...[
                      const SizedBox(height: 12),
                      for (final entry in day!.exercises.asMap().entries)
                        ExerciseTile(
                            exercise: entry.value,
                            index: entry.key,
                            onTap: () => _showExercise(entry.value)),
                      if (data.canWrite) ...[
                        const SizedBox(height: 14),
                        GradientActionButton(
                            label: 'Registrar entrenamiento',
                            busy: _opening,
                            busyLabel: 'Abriendo…',
                            icon: Icons.play_arrow_rounded,
                            onPressed:
                                canLog ? () => _openSession(data.today) : null),
                      ],
                    ],
                  ]))),
      const SizedBox(height: 24),
      const TrainingEyebrow('Tu semana'),
      const SizedBox(height: 10),
      Row(children: [
        for (var i = 0; i < 7; i++)
          Expanded(child: _weekCell(plan, shiftDate(monday, i), data.today, i)),
      ]),
      if (data.canWrite) ...[
        const SizedBox(height: 24),
        const TrainingEyebrow('¿Olvidaste registrar?'),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final offset in [1, 2])
            OutlinedButton.icon(
                onPressed: canLog
                    ? () => _openSession(shiftDate(data.today, -offset))
                    : null,
                icon: const Icon(Icons.history, size: 18),
                label: Text(
                    '${offset == 1 ? 'Ayer' : 'Anteayer'} · ${shortDate(shiftDate(data.today, -offset))}')),
        ]),
      ],
    ];
  }

  Widget _weekCell(TrainingPlan plan, String date, String today, int index) {
    final colors = Theme.of(context).colorScheme;
    final day = plan.dayFor(date);
    final current = date == today;
    return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Semantics(
            button: day != null,
            label:
                '${longDate(date)}: ${day == null ? 'sin programación' : day.kind == 'rest' ? 'descanso' : day.name}',
            child: ExcludeSemantics(
                child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: day == null ? null : () => _showDay(day),
                    child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                            color: current
                                ? colors.primary
                                : colors.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(14)),
                        child: Column(children: [
                          Text(weekdayInitials[index],
                              style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: current
                                      ? colors.onPrimary
                                      : colors.onSurfaceVariant)),
                          const SizedBox(height: 6),
                          Icon(
                              day == null
                                  ? Icons.remove
                                  : day.kind == 'rest'
                                      ? Icons.spa_outlined
                                      : Icons.fitness_center,
                              size: 18,
                              color: current
                                  ? colors.onPrimary
                                  : colors.onSurfaceVariant),
                        ]))))));
  }

  List<Widget> _routine(TrainingPlan plan) {
    final colors = Theme.of(context).colorScheme;
    return [
      Text(plan.name,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        TrainingChip(plan.scheduleLabel, icon: Icons.event_repeat),
        TrainingChip('Desde ${shortDate(plan.startDate)}',
            icon: Icons.flag_outlined),
      ]),
      const SizedBox(height: 16),
      for (final entry in plan.days.asMap().entries)
        Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                leading: Icon(entry.value.kind == 'rest'
                    ? Icons.spa_outlined
                    : Icons.fitness_center),
                title: Text(entry.value.name,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text([
                  // 2024-01-01 was a Monday: day offsets map to weekday names.
                  plan.schedule == 'weekly'
                      ? _capitalized(
                          weekdayName(shiftDate('2024-01-01', entry.key)))
                      : entry.value.date != null
                          ? shortDate(entry.value.date!)
                          : 'Día ${entry.key + 1}',
                  entry.value.kind == 'rest'
                      ? 'Descanso'
                      : trainingCount(entry.value.exercises.length, 'ejercicio',
                          'ejercicios'),
                ].join(' · ')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showDay(entry.value))),
      const SizedBox(height: 16),
      Text('Datos de ejercicios: RepDB · repdb.co',
          style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
    ];
  }

  String _capitalized(String value) =>
      value[0].toUpperCase() + value.substring(1);
}

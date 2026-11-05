import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../auth/models/session_models.dart';
import '../../client/models/client_profile.dart';
import '../../settings/services/settings_controller.dart';
import '../models/training.dart';
import '../services/training_service.dart';
import 'home_tab.dart';
import 'plans_tab.dart';
import 'progress_tab.dart';
import 'training_views.dart';
import 'training_session_screen.dart';

class ClientShell extends StatefulWidget {
  const ClientShell(
      {super.key,
      required this.profile,
      required this.service,
      required this.account,
      this.settings});
  final ClientProfile profile;
  final TrainingService service;

  /// Cuenta tab: profile, access and Configuración.
  final Widget account;
  final SettingsController? settings;
  @override
  State<ClientShell> createState() => _ClientShellState();
}

class _ClientShellState extends State<ClientShell> {
  late final SettingsController _settings =
      widget.settings ?? SettingsController();
  int _selected = 0, _epoch = 0;
  TrainingContext? _data;
  TrainingHistory? _history;
  DateTime? _cachedAt;
  String? _error;
  bool _loading = true, _opening = false, _historyFailed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    if (widget.settings == null) _settings.dispose();
    super.dispose();
  }

  // History is a complement: failing it never hides the routine.
  Future<TrainingHistory?> _fetchHistory() async {
    try {
      return await widget.service.history();
    } catch (_) {
      return null;
    }
  }

  Future<void> _load() async {
    final epoch = ++_epoch;
    setState(() {
      _loading = true;
      _error = null;
    });
    final history = _fetchHistory();
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
      final loaded = await history;
      if (mounted && epoch == _epoch) {
        setState(() {
          _history = loaded;
          _historyFailed = loaded == null;
          _loading = false;
        });
      }
    }
  }

  bool get _canLog =>
      _data != null && _data!.canWrite && _cachedAt == null && !_opening;

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
                  contextData: data,
                  service: widget.service,
                  history: _history,
                  settings: _settings.value,
                  onShowProgress: () => setState(() => _selected = 2))));
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

  /// Center button: today's workout directly, otherwise the recent days.
  void _start() {
    final data = _data, plan = data?.plan;
    String? problem;
    if (data == null || plan == null) {
      problem = 'Aún no tienes una rutina asignada.';
    } else if (!data.canWrite) {
      problem = 'El registro está pausado por ahora.';
    } else if (_cachedAt != null) {
      problem = 'Conéctate a internet para registrar tu entrenamiento.';
    }
    if (problem != null) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(problem)));
      return;
    }
    if (data!.day?.kind == 'training') {
      _openSession(data.today);
      return;
    }
    final recent = [
      for (final offset in [1, 2])
        if (plan!.dayFor(shiftDate(data.today, -offset))?.kind == 'training')
          shiftDate(data.today, -offset)
    ];
    showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (sheet) => SafeArea(
            child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                          data.day?.kind == 'rest'
                              ? 'Hoy toca descansar'
                              : 'Hoy no tienes entrenamiento programado',
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      Text(recent.isEmpty
                          ? 'Disfruta tu recuperación; tu siguiente sesión aparecerá en Inicio.'
                          : '¿Quieres registrar un día anterior?'),
                      const SizedBox(height: 8),
                      for (final date in recent)
                        ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.history),
                            title: Text(plan!.dayFor(date)!.name),
                            subtitle: Text(capitalized(longDate(date))),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () {
                              Navigator.pop(sheet);
                              _openSession(date);
                            }),
                    ]))));
  }

  void _showDay(TrainingDay day) => Navigator.push(context,
      MaterialPageRoute<void>(builder: (_) => TrainingDayScreen(day: day)));

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 768;
    const items = [
      (Icons.home_outlined, Icons.home, 'Inicio'),
      (Icons.calendar_month_outlined, Icons.calendar_month, 'Planes'),
      (Icons.insights_outlined, Icons.insights, 'Progreso'),
      (Icons.person_outline, Icons.person, 'Cuenta'),
    ];
    return Scaffold(
        body: SafeArea(
            child: Row(children: [
          if (wide)
            NavigationRail(
                labelType: NavigationRailLabelType.all,
                selectedIndex: _selected,
                leading: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: FloatingActionButton(
                        tooltip: 'Entrenar',
                        elevation: 0,
                        onPressed: _opening ? null : _start,
                        child: const Icon(Icons.play_arrow_rounded))),
                onDestinationSelected: (index) =>
                    setState(() => _selected = index),
                destinations: [
                  for (final (icon, selected, label) in items)
                    NavigationRailDestination(
                        icon: Icon(icon),
                        selectedIcon: Icon(selected),
                        label: Text(label))
                ]),
          Expanded(
              child: _selected == 3
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
        bottomNavigationBar: wide ? null : _bottomBar(items));
  }

  Widget _bottomBar(List<(IconData, IconData, String)> items) {
    final colors = Theme.of(context).colorScheme;
    final background = Theme.of(context).navigationBarTheme.backgroundColor;
    Widget item(int index) {
      final (icon, selectedIcon, label) = items[index];
      final selected = _selected == index;
      final color = selected ? colors.primary : colors.onSurfaceVariant;
      return Expanded(
          child: Semantics(
              button: true,
              selected: selected,
              label: label,
              child: ExcludeSemantics(
                  child: InkWell(
                      onTap: () => setState(() => _selected = index),
                      child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(selected ? selectedIcon : icon, color: color),
                            const SizedBox(height: 4),
                            Text(label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: selected
                                        ? FontWeight.w800
                                        : FontWeight.w500,
                                    color: color)),
                          ]))))));
    }

    // Labels must fit 320 px; content keeps full text scaling.
    return MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.3,
        child: Container(
            decoration: BoxDecoration(
                color: background,
                border: Border(top: BorderSide(color: colors.outlineVariant))),
            child: SafeArea(
                top: false,
                child: Row(children: [
                  item(0),
                  item(1),
                  Expanded(
                      child: Semantics(
                          button: true,
                          label: 'Entrenar',
                          child: ExcludeSemantics(
                              child: InkWell(
                                  onTap: _opening ? null : _start,
                                  child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 6),
                                      child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                                width: 48,
                                                height: 48,
                                                decoration: BoxDecoration(
                                                    shape: BoxShape.circle,
                                                    gradient:
                                                        BrandColors.gradient,
                                                    boxShadow: [
                                                      BoxShadow(
                                                          color: colors.primary
                                                              .withValues(
                                                                  alpha: .35),
                                                          blurRadius: 12,
                                                          offset: const Offset(
                                                              0, 4))
                                                    ]),
                                                child: _opening
                                                    ? const Padding(
                                                        padding:
                                                            EdgeInsets.all(14),
                                                        child:
                                                            CircularProgressIndicator(
                                                                strokeWidth: 2,
                                                                color: Colors
                                                                    .white))
                                                    : const Icon(
                                                        Icons
                                                            .play_arrow_rounded,
                                                        color: Colors.white,
                                                        size: 30)),
                                            const SizedBox(height: 2),
                                            Text('Entrenar',
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w800,
                                                    color: colors.primary)),
                                          ])))))),
                  item(2),
                  item(3),
                ]))));
  }

  Widget _content() {
    final data = _data, plan = data?.plan;
    final today = data?.today ?? trainingIso(DateTime.now());
    final header = switch (_selected) {
      0 => ScreenHeader(
          title: 'Hola, ${widget.profile.fullName.split(' ').first}',
          subtitle: data == null ? 'Tu día' : capitalized(longDate(data.today)),
          trailing: IconButton.filledTonal(
              tooltip: 'Configuración',
              onPressed: () => setState(() => _selected = 3),
              icon: const Icon(Icons.settings_outlined))),
      1 => const ScreenHeader(
          title: 'Planes', subtitle: 'Lo que te asignó tu profesional'),
      _ => ScreenHeader(
          title: 'Progreso',
          subtitle: 'Tu avance e historial',
          trailing: _history == null
              ? null
              : IconButton.filledTonal(
                  tooltip: 'Historial',
                  onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                          builder: (_) => HistoryScreen(
                              initial: _history!, service: widget.service))),
                  icon: const Icon(Icons.history))),
    };
    if (_selected == 2) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        header,
        ProgressTab(
            history: _history,
            failed: _historyFailed && !_loading,
            today: today,
            onRetry: _load,
            service: widget.service),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      header,
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
        if (data != null && _selected == 0)
          HomeTab(
              data: data,
              history: _history,
              canLog: _canLog,
              opening: _opening,
              onStart: _openSession,
              onShowDay: _showDay,
              onOpenProgress: () => setState(() => _selected = 2)),
        if (data != null && _selected == 1)
          PlansTab(plan: plan, today: data.today, onShowDay: _showDay),
      ],
    ]);
  }
}

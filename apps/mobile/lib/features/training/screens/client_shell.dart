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
  // Live workout kept mounted while minimized, until it is finalized.
  Widget? _session;
  String? _sessionName;
  bool _minimized = false;

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
    // shortcut: one live workout at a time; finalize or discard it first.
    if (_session != null) return setState(() => _minimized = false);
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
      setState(() {
        _sessionName = data.day!.name;
        _minimized = false;
        _session = TrainingSessionScreen(
            contextData: data,
            service: widget.service,
            history: _history,
            settings: _settings.value,
            onShowProgress: () => setState(() => _selected = 2),
            onMinimize: () => setState(() => _minimized = true),
            onClose: _closeSession);
      });
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

  void _closeSession() {
    if (!mounted) return;
    setState(() => _session = null);
    _load();
  }

  Future<void> _discardSession() async {
    final discard = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
                title: const Text('¿Descartar el entrenamiento?'),
                content: const Text(
                    'Se pierde lo que no hayas guardado. El avance guardado se conserva.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialog, false),
                      child: const Text('Seguir entrenando')),
                  TextButton(
                      onPressed: () => Navigator.pop(dialog, true),
                      child: const Text('Descartar'))
                ]));
    if (discard == true) _closeSession();
  }

  Widget _activeBar(bool wide) {
    final colors = Theme.of(context).colorScheme;
    return Material(
        color: colors.primaryContainer,
        child: SafeArea(
            top: false,
            bottom: wide,
            child: ListTile(
                leading: Icon(Icons.fitness_center,
                    color: colors.onPrimaryContainer),
                title: const Text('Entrenamiento en curso',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('${_sessionName ?? ''} · Toca para volver',
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                textColor: colors.onPrimaryContainer,
                onTap: () => setState(() => _minimized = false),
                trailing: IconButton(
                    tooltip: 'Descartar entrenamiento',
                    color: colors.onPrimaryContainer,
                    onPressed: _discardSession,
                    icon: const Icon(Icons.close)))));
  }

  /// Center button: today's workout directly, otherwise the recent days.
  void _start() {
    if (_session != null) return setState(() => _minimized = false);
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
        builder: (sheet) {
          final colors = Theme.of(sheet).colorScheme;
          return SafeArea(
              child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(children: [
                          Expanded(
                              child: Text(
                                  data.day?.kind == 'rest'
                                      ? 'Hoy toca descansar'
                                      : 'Hoy no tienes entrenamiento programado',
                                  style: const TextStyle(
                                      fontSize: 19,
                                      fontWeight: FontWeight.w800))),
                          IconButton(
                              tooltip: 'Cerrar',
                              onPressed: () => Navigator.pop(sheet),
                              icon: const Icon(Icons.close, size: 20)),
                        ]),
                        const SizedBox(height: 4),
                        Text(
                            recent.isEmpty
                                ? 'Disfruta tu recuperación; tu siguiente sesión aparecerá en Inicio.'
                                : '¿Quieres registrar un día anterior?',
                            style: TextStyle(color: colors.onSurfaceVariant)),
                        if (recent.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          for (final date in recent)
                            Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: DecoratedBox(
                                    decoration:
                                        innerPanelDecoration(sheet, radius: 14),
                                    child: Material(
                                        type: MaterialType.transparency,
                                        borderRadius: BorderRadius.circular(14),
                                        clipBehavior: Clip.antiAlias,
                                        child: ListTile(
                                            contentPadding:
                                                const EdgeInsets.symmetric(
                                                    horizontal: 14,
                                                    vertical: 2),
                                            leading: Container(
                                                width: 38,
                                                height: 38,
                                                decoration: BoxDecoration(
                                                    gradient:
                                                        BrandColors.gradient,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            10)),
                                                child: const Icon(Icons.history,
                                                    color: Colors.white,
                                                    size: 20)),
                                            title: Text(
                                                plan!.dayFor(date)!.name,
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.w700)),
                                            subtitle: Text(
                                                capitalized(longDate(date))),
                                            trailing:
                                                const Icon(Icons.chevron_right),
                                            onTap: () {
                                              Navigator.pop(sheet);
                                              _openSession(date);
                                            })))),
                        ],
                      ])));
        });
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
    final session = _session;
    final open = session != null && !_minimized;
    final bar = session != null && _minimized;
    final shell = Scaffold(
        body: DecoratedBox(
            decoration: brandGlow(context),
            child: SafeArea(
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
                            final gutter =
                                constraints.maxWidth < 360 ? 16.0 : 20.0;
                            // Each tab keeps its own scroll; switching starts
                            // at the top instead of mid-page.
                            return ListView(
                                key: PageStorageKey('client-tab-$_selected'),
                                padding:
                                    EdgeInsets.fromLTRB(gutter, 16, gutter, 32),
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [
                                  Center(
                                      child: ConstrainedBox(
                                          constraints: const BoxConstraints(
                                              maxWidth: 560),
                                          child: _content()))
                                ]);
                          })))
            ]))),
        bottomNavigationBar: wide && !bar
            ? null
            : Column(mainAxisSize: MainAxisSize.min, children: [
                if (bar) _activeBar(wide),
                if (!wide) _bottomBar(items),
              ]));
    // Back minimizes the open workout instead of closing it.
    return PopScope(
        canPop: !open,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && open) setState(() => _minimized = true);
        },
        child: Stack(fit: StackFit.expand, children: [
          ExcludeSemantics(excluding: open, child: shell),
          if (session != null) Offstage(offstage: _minimized, child: session),
        ]));
  }

  Widget _bottomBar(List<(IconData, IconData, String)> items) {
    final colors = Theme.of(context).colorScheme;
    final navigation = Theme.of(context).navigationBarTheme;
    final background = navigation.backgroundColor;
    Color tone(bool selected) => navigation.iconTheme!
        .resolve({if (selected) WidgetState.selected})!.color!;
    Widget item(int index) {
      final (icon, selectedIcon, label) = items[index];
      final selected = _selected == index;
      final color = tone(selected);
      final disableAnim = MediaQuery.disableAnimationsOf(context);
      return Expanded(
          child: Semantics(
              button: true,
              selected: selected,
              label: label,
              child: ExcludeSemantics(
                  child: InkWell(
                      onTap: () => setState(() => _selected = index),
                      child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            AnimatedContainer(
                                duration: disableAnim
                                    ? Duration.zero
                                    : const Duration(milliseconds: 180),
                                curve: Curves.easeOutCubic,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 3),
                                decoration: BoxDecoration(
                                    color: selected
                                        ? colors.primaryContainer
                                            .withValues(alpha: 0.85)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(99)),
                                child: Icon(selected ? selectedIcon : icon,
                                    size: 22, color: color)),
                            const SizedBox(height: 3),
                            Text(label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: selected
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    color: color)),
                          ]))))));
    }

    // Labels must fit 320 px; content keeps full text scaling.
    return MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.3,
        child: Container(
            decoration: BoxDecoration(
                color: background,
                border: Border(top: BorderSide(color: colors.outlineVariant)),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(
                          alpha: Theme.of(context).brightness == Brightness.dark
                              ? 0.45
                              : 0.06),
                      blurRadius: 16,
                      offset: const Offset(0, -4))
                ]),
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
                                      padding: const EdgeInsets.only(
                                          top: 4, bottom: 6),
                                      child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                                width: 50,
                                                height: 50,
                                                decoration: BoxDecoration(
                                                    shape: BoxShape.circle,
                                                    gradient:
                                                        BrandColors.gradient,
                                                    border: Border.all(
                                                        width: 1.5,
                                                        color: Colors.white
                                                            .withValues(
                                                                alpha: .22)),
                                                    boxShadow: [
                                                      BoxShadow(
                                                          color: colors.primary
                                                              .withValues(
                                                                  alpha: .52),
                                                          blurRadius: 18,
                                                          spreadRadius: 1,
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
                                                        size: 29)),
                                            const SizedBox(height: 2),
                                            Text('Entrenar',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    fontSize: 11.5,
                                                    fontWeight: FontWeight.w800,
                                                    color: tone(true))),
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

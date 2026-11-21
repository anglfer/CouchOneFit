import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/utils/friendly_date.dart';
import '../../../shared/widgets/icon_badge.dart';
import '../../../shared/widgets/journey_surface.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/sheet_parts.dart';
import '../../auth/models/session_models.dart';
import '../../check_in/models/check_in.dart';
import '../../check_in/screens/check_in_screen.dart';
import '../../check_in/services/check_in_service.dart';
import '../../check_in/widgets/check_in_card.dart';
import '../../check_in/widgets/follow_up_progress.dart';
import '../../client/models/client_profile.dart';
import '../../nutrition/models/nutrition_plan.dart';
import '../../nutrition/services/nutrition_service.dart';
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
      this.account = const SizedBox.shrink(),
      this.accountBuilder,
      this.nutritionService,
      this.checkInService,
      this.settings});
  final ClientProfile profile;
  final TrainingService service;
  final NutritionService? nutritionService;
  final CheckInService? checkInService;

  /// Cuenta tab: profile, access and Configuración.
  final Widget account;
  final Widget Function(VoidCallback onOpenProgress)? accountBuilder;
  final SettingsController? settings;
  @override
  State<ClientShell> createState() => _ClientShellState();
}

class _ClientShellState extends State<ClientShell> {
  late final SettingsController _settings =
      widget.settings ?? SettingsController();
  late final NutritionService _nutritionService = widget.nutritionService ??
      NutritionService(apiClient: widget.service.apiClient);
  late final CheckInService _checkInService = widget.checkInService ??
      CheckInService(apiClient: widget.service.apiClient);
  int _selected = 0, _epoch = 0;
  bool _plansNutrition = false;
  TrainingContext? _data;
  TrainingHistory? _history;
  DateTime? _cachedAt;
  String? _error;
  bool _loading = true, _opening = false, _historyFailed = false;

  NutritionPlan? _nutritionPlan;
  DateTime? _nutritionCachedAt;
  String? _nutritionError;
  bool _nutritionLoading = true;

  CheckInContext? _checkIn;
  String? _checkInError;
  bool _checkInLoading = true;
  double? _lastKnownWeight;

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

  Future<void> _loadNutrition() async {
    final epoch = _epoch;
    setState(() {
      _nutritionLoading = true;
      _nutritionError = null;
    });
    try {
      final fetched = await _nutritionService.fetchActivePlan();
      if (!mounted || epoch != _epoch) return;
      await _nutritionService.cache.save(widget.profile.id, fetched.rawPlan);
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _nutritionPlan = fetched.plan;
        _nutritionCachedAt = null;
      });
    } catch (error) {
      if (NutritionService.denied(error)) {
        await _nutritionService.cache.clear();
      }
      final cached = NutritionService.disconnected(error)
          ? await _nutritionService.cache.read(clientId: widget.profile.id)
          : null;
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _nutritionPlan = cached?.plan;
        _nutritionCachedAt = cached?.updatedAt;
        _nutritionError = cached != null
            ? null
            : error is AuthApiException
                ? error.message
                : 'No pudimos consultar tu plan alimenticio. Reintenta la consulta.';
      });
    } finally {
      if (mounted && epoch == _epoch) {
        setState(() => _nutritionLoading = false);
      }
    }
  }

  /// Independent of the routine: a client without plans still checks in.
  Future<void> _loadCheckIn() async {
    final epoch = _epoch;
    setState(() {
      _checkInLoading = true;
      _checkInError = null;
    });
    try {
      final data = await _checkInService.context();
      if (!mounted || epoch != _epoch) return;
      if (data.clientId != widget.profile.id) {
        throw const FormatException('Cuenta distinta');
      }
      setState(() {
        _checkIn = data;
        if (data.checkIn?.bodyWeightKg != null) {
          _lastKnownWeight = data.checkIn!.bodyWeightKg;
        }
      });
    } catch (error) {
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _checkIn = null;
        _checkInError = error is AuthApiException
            ? error.message
            : 'No pudimos consultar tu check-in. Reintenta la consulta.';
      });
    } finally {
      if (mounted && epoch == _epoch) setState(() => _checkInLoading = false);
    }
  }

  Future<void> _openCheckIn(String date) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final current = _checkIn;
      final data = current != null && current.localDate == date
          ? current
          : await _checkInService.context(date: date);
      if (!mounted) return;
      final saved = await Navigator.push<CheckIn>(
          context,
          MaterialPageRoute(
              builder: (_) => CheckInScreen(
                    service: _checkInService,
                    initial: data,
                    previousWeightKg: _lastKnownWeight,
                  )));
      if (saved == null || !mounted) return;
      if (saved.bodyWeightKg != null) {
        _lastKnownWeight = saved.bodyWeightKg;
      }
      // Inicio reflects the check-in only after the server confirmed it.
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Check-in guardado')));
      _loadCheckIn();
    } catch (error) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(error is AuthApiException
                ? error.message
                : 'No pudimos abrir el check-in. Revisa tu conexión.')));
    }
  }

  Future<void> _load() async {
    final epoch = ++_epoch;
    setState(() {
      _loading = true;
      _error = null;
    });
    final history = _fetchHistory();
    final nutrition = _loadNutrition();
    final checkIn = _loadCheckIn();
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
      await nutrition;
      await checkIn;
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
            onOpenCheckIn: _checkIn?.checkIn == null && data.canWrite
                ? () => _openCheckIn(data.today)
                : null,
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
                icon: const Icon(Icons.delete_outline_rounded,
                    color: BrandColors.error),
                title: const Text('¿Descartar el entrenamiento?'),
                content: const Text(
                    'Se pierde lo que no hayas guardado. El avance guardado se conserva.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialog, false),
                      child: const Text('Seguir entrenando')),
                  TextButton(
                      style: TextButton.styleFrom(
                          foregroundColor: BrandColors.error),
                      onPressed: () => Navigator.pop(dialog, true),
                      child: const Text('Descartar'))
                ]));
    if (discard == true) _closeSession();
  }

  /// "Now playing" strip for the minimized workout, clear of the center button.
  Widget _activeBar(bool wide) {
    return Padding(
        padding: EdgeInsets.fromLTRB(12, 8, 12, wide ? 8 : 34),
        child: JourneySurface(
            radius: 18,
            child: Material(
                type: MaterialType.transparency,
                child: ListTile(
                    contentPadding: const EdgeInsets.fromLTRB(14, 2, 6, 2),
                    leading: const Icon(Icons.fitness_center,
                        color: Colors.white, size: 22),
                    title: const Text('Entrenamiento en curso',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w800)),
                    subtitle: Text('${_sessionName ?? ''} · Toca para volver',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Color(0xE6FFFFFF))),
                    onTap: () => setState(() => _minimized = false),
                    trailing: IconButton(
                        tooltip: 'Descartar entrenamiento',
                        color: Colors.white,
                        onPressed: _discardSession,
                        icon: const Icon(Icons.close_rounded))))));
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
        isScrollControlled: true,
        builder: (sheet) => SafeArea(
            child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SheetHeader(
                          data.day?.kind == 'rest'
                              ? 'Hoy toca descansar'
                              : 'Hoy no tienes entrenamiento programado',
                          subtitle: recent.isEmpty
                              ? 'Disfruta tu recuperación; tu siguiente sesión aparecerá en Inicio.'
                              : '¿Quieres registrar un día anterior?'),
                      for (final date in recent)
                        SheetOption(
                            leading: const IconBadge(Icons.history,
                                filled: true, size: 40),
                            title: plan!.dayFor(date)!.name,
                            subtitle: capitalized(longDate(date)),
                            onTap: () {
                              Navigator.pop(sheet);
                              _openSession(date);
                            }),
                    ]))));
  }

  void _showDay(TrainingDay day) {
    final data = _data;
    final isToday = data != null &&
        data.plan?.dayFor(data.today)?.id == day.id &&
        day.kind == 'training' &&
        _canLog;
    final session = isToday ? _history?.on(data.today) : null;
    final label = session == null
        ? 'Empezar entrenamiento'
        : session.status == 'draft'
            ? 'Continuar entrenamiento'
            : 'Ver o corregir registro';
    Navigator.push(
        context,
        MaterialPageRoute<void>(
            builder: (_) => TrainingDayScreen(
                day: day,
                startLabel: label,
                onStart: isToday
                    ? () {
                        Navigator.pop(context);
                        _openSession(data.today);
                      }
                    : null)));
  }

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
        floatingActionButton: wide ? null : _trainButton(),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
        body: DecoratedBox(
            decoration: brandGlow(context),
            child: SafeArea(
                bottom: wide,
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
                      child: Column(children: [
                    Expanded(
                        child: _selected == 3
                            ? (widget.accountBuilder?.call(
                                    () => setState(() => _selected = 2)) ??
                                widget.account)
                            : RefreshIndicator(
                                onRefresh: _load,
                                child: LayoutBuilder(
                                    builder: (context, constraints) {
                                  final gutter =
                                      constraints.maxWidth < 360 ? 16.0 : 20.0;
                                  // Each tab keeps its own scroll; switching
                                  // starts at the top instead of mid-page.
                                  return ListView(
                                      key: PageStorageKey(
                                          'client-tab-$_selected'),
                                      padding: EdgeInsets.fromLTRB(
                                          gutter, 16, gutter, 96),
                                      physics:
                                          const AlwaysScrollableScrollPhysics(),
                                      children: [
                                        Center(
                                            child: ConstrainedBox(
                                                constraints:
                                                    const BoxConstraints(
                                                        maxWidth: 560),
                                                child: _content()))
                                      ]);
                                }))),
                    if (bar) _activeBar(wide),
                  ])),
                ]))),
        bottomNavigationBar: wide ? null : _bottomBar(items));
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

  /// Raised center action, docked over the bar's top edge.
  Widget _trainButton() {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
        button: true,
        label: 'Entrenar',
        onTap: _opening ? null : _start,
        child: ExcludeSemantics(
            child: Container(
                width: 64,
                height: 64,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Theme.of(context).navigationBarTheme.backgroundColor,
                    boxShadow: [
                      BoxShadow(
                          color:
                              colors.primary.withValues(alpha: dark ? .4 : .28),
                          blurRadius: 20,
                          offset: const Offset(0, 6))
                    ]),
                child: Material(
                    color: actionFill(context),
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                        onTap: _opening ? null : _start,
                        child: _opening
                            ? const Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.4, color: Colors.white))
                            : const Icon(Icons.play_arrow_rounded,
                                color: Colors.white, size: 32))))));
  }

  Widget _bottomBar(List<(IconData, IconData, String)> items) {
    final navigation = Theme.of(context).navigationBarTheme;
    final disableAnim = MediaQuery.disableAnimationsOf(context);
    Color tone(bool selected) => navigation.iconTheme!
        .resolve({if (selected) WidgetState.selected})!.color!;
    Widget label(String text, Color color, bool strong) => Text(text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
            fontSize: 11.5,
            fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
            color: color));
    Widget item(int index) {
      final (icon, selectedIcon, text) = items[index];
      final selected = _selected == index;
      final color = tone(selected);
      return Expanded(
          child: Semantics(
              button: true,
              selected: selected,
              label: text,
              onTap: () => setState(() => _selected = index),
              child: ExcludeSemantics(
                  child: InkWell(
                      onTap: () => setState(() => _selected = index),
                      child: Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            // Accent line on the bar's edge marks the place.
                            AnimatedContainer(
                                duration: disableAnim
                                    ? Duration.zero
                                    : const Duration(milliseconds: 200),
                                curve: Curves.easeOutCubic,
                                width: selected ? 28 : 0,
                                height: 3,
                                decoration: BoxDecoration(
                                    color: color,
                                    borderRadius: const BorderRadius.vertical(
                                        bottom: Radius.circular(3)))),
                            const SizedBox(height: 7),
                            Icon(selected ? selectedIcon : icon,
                                size: 24, color: color),
                            const SizedBox(height: 3),
                            label(text, color, selected),
                          ]))))));
    }

    // Labels must fit 320 px; content keeps full text scaling.
    return MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.3,
        child: DecoratedBox(
            decoration: BoxDecoration(
                color: navigation.backgroundColor,
                border: Border(
                    top: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant))),
            child: SafeArea(
                top: false,
                child:
                    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  item(0),
                  item(1),
                  // Announced by the button above it.
                  Expanded(
                      child: ExcludeSemantics(
                          child: InkWell(
                              onTap: _opening ? null : _start,
                              child: Padding(
                                  padding:
                                      const EdgeInsets.only(top: 37, bottom: 8),
                                  child: Center(
                                      heightFactor: 1,
                                      child: label(
                                          'Entrenar', tone(true), true)))))),
                  item(2),
                  item(3),
                ]))));
  }

  Widget _content() {
    final data = _data, plan = data?.plan;
    final serverToday = data?.today ?? _checkIn?.today;
    final today = serverToday ?? trainingIso(DateTime.now());
    final header = switch (_selected) {
      0 => ScreenHeader(
          title: 'Hola, ${widget.profile.fullName.split(' ').first}',
          subtitle: serverToday == null
              ? 'Tu día'
              : capitalized(longDate(serverToday)),
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
            service: widget.service,
            overviewFooter: FollowUpProgress(
                key: ValueKey(_epoch),
                service: _checkInService,
                clientId: widget.profile.id)),
      ]);
    }
    final homeErrors = [
      if (_error != null) 1,
      if (_checkInError != null && _checkIn == null) 1,
      if (_nutritionError != null && _nutritionPlan == null) 1,
    ].length;
    final unifyHomeErrors = _selected == 0 && homeErrors >= 2;
    final showTopCheckIn = _selected == 0 &&
        data == null &&
        (_checkIn != null || (!unifyHomeErrors && _checkInError != null));
    final homeDailySlot = (_selected == 0 && data != null)
        ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_checkIn != null || (!unifyHomeErrors && _checkInError != null))
              CheckInCard(
                  context_: _checkIn,
                  loading: _checkInLoading,
                  error: unifyHomeErrors ? null : _checkInError,
                  onOpen: _openCheckIn,
                  onRetry: _loadCheckIn),
            _homeNutritionCard(context, suppressError: unifyHomeErrors),
          ])
        : null;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      header,
      if (unifyHomeErrors) ...[
        NoticeBanner(
            text:
                'No pudimos cargar tu información de hoy. Revisa tu conexión.',
            tone: NoticeTone.error,
            onRetry: _loading ? null : _load),
        const SizedBox(height: 12),
      ],
      if (showTopCheckIn) ...[
        CheckInCard(
            context_: _checkIn,
            loading: _checkInLoading,
            error: unifyHomeErrors ? null : _checkInError,
            onOpen: _openCheckIn,
            onRetry: _loadCheckIn),
        const SizedBox(height: 14),
      ],
      if (_loading && data == null)
        const _LoadingCard()
      else ...[
        if (_error != null && !unifyHomeErrors)
          NoticeBanner(
              text: _error!,
              tone: NoticeTone.error,
              onRetry: _loading ? null : _load),
        if (_cachedAt != null)
          NoticeBanner(
              icon: Icons.cloud_off_outlined,
              tone: NoticeTone.warning,
              text:
                  'Lectura guardada · actualizada ${friendlySavedAt(_cachedAt!)}. Conéctate para actualizar o registrar series.'),
        if (data != null && plan != null && !data.canWrite)
          const NoticeBanner(
              icon: Icons.pause_circle_outline_rounded,
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
              onOpenProgress: () => setState(() => _selected = 2),
              dailySlot: homeDailySlot),
        if (data != null && _selected == 1)
          PlansTab(
            plan: plan,
            today: data.today,
            onShowDay: _showDay,
            nutritionPlan: _nutritionPlan,
            nutritionLoading: _nutritionLoading,
            nutritionError: _nutritionError,
            nutritionCachedAt: _nutritionCachedAt,
            onRetryNutrition: _loadNutrition,
            showNutrition: _plansNutrition,
            onSectionChanged: (v) => setState(() => _plansNutrition = v),
          ),
      ],
      if (_selected == 0 && data == null)
        _homeNutritionCard(context, suppressError: unifyHomeErrors),
    ]);
  }

  /// HU-035: independent nutrition summary on Inicio (works even if training fails).
  Widget _homeNutritionCard(BuildContext context,
      {bool suppressError = false}) {
    final colors = Theme.of(context).colorScheme;
    if (_nutritionError != null && _nutritionPlan == null) {
      if (suppressError) return const SizedBox.shrink();
      return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: NoticeBanner(
              text: _nutritionError!,
              tone: NoticeTone.error,
              onRetry: _nutritionLoading ? null : _loadNutrition));
    }
    if (_nutritionLoading && _nutritionPlan == null) {
      return const SizedBox.shrink();
    }
    final nutrition = _nutritionPlan;
    void openNutrition() => setState(() {
          _plansNutrition = true;
          _selected = 1;
        });
    if (nutrition == null) {
      return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Card(
              margin: EdgeInsets.zero,
              child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 12, 16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CardTitle(
                            icon: Icons.restaurant_outlined,
                            title: 'Alimentación de hoy',
                            action: 'Ver Planes',
                            onAction: openNutrition),
                        const SizedBox(height: 8),
                        Text(
                            'Sin plan alimenticio activo. Cuando tu profesional lo active aparecerá aquí.',
                            style: TextStyle(color: colors.onSurfaceVariant)),
                      ]))));
    }
    final parts = <String>[
      trainingCount(nutrition.meals.length, 'comida', 'comidas'),
      if (nutrition.caloriesTarget != null)
        '${nutrition.caloriesTarget!.round()} kcal',
      if (nutrition.proteinTargetG != null)
        'P ${nutrition.proteinTargetG!.round()}g',
      if (nutrition.carbsTargetG != null)
        'C ${nutrition.carbsTargetG!.round()}g',
      if (nutrition.fatTargetG != null) 'G ${nutrition.fatTargetG!.round()}g',
    ];
    return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Card(
            margin: EdgeInsets.zero,
            child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 12, 16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CardTitle(
                          icon: Icons.restaurant_outlined,
                          title: 'Alimentación de hoy',
                          action: 'Ver plan',
                          onAction: openNutrition),
                      const SizedBox(height: 8),
                      Text(nutrition.name,
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(parts.join(' · '),
                          style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: colors.onSurfaceVariant,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ])),
                      if (_nutritionCachedAt != null) ...[
                        const SizedBox(height: 6),
                        Text(
                            'Lectura guardada · ${friendlySavedAt(_nutritionCachedAt!)}',
                            style: TextStyle(
                                fontSize: 12, color: colors.onSurfaceVariant)),
                      ],
                    ]))));
  }
}

/// Static placeholder shaped like the week card, so the first load does not
/// jump from a lone spinner to a full layout.
class _LoadingCard extends StatelessWidget {
  const _LoadingCard();
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final block = colors.surfaceContainerHighest;
    return Semantics(
        label: 'Cargando tu rutina',
        child: ExcludeSemantics(
            child: Card(
                margin: EdgeInsets.zero,
                child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(children: [
                            for (var i = 0; i < 7; i++)
                              Expanded(
                                  child: Center(
                                      child: Container(
                                          width: 34,
                                          height: 34,
                                          decoration: BoxDecoration(
                                              color: block,
                                              shape: BoxShape.circle)))),
                          ]),
                          const SizedBox(height: 16),
                          Container(
                              height: 96,
                              decoration: innerPanelDecoration(context)),
                          const SizedBox(height: 14),
                          Row(children: [
                            const SizedBox.square(
                                dimension: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2)),
                            const SizedBox(width: 10),
                            Expanded(
                                child: Text('Cargando tu rutina…',
                                    style: TextStyle(
                                        color: colors.onSurfaceVariant))),
                          ]),
                        ])))));
  }
}

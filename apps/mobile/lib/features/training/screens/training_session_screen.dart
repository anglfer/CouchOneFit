import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../shared/theme/app_theme.dart';
import '../../auth/models/session_models.dart';
import '../../settings/models/app_settings.dart';
import '../models/training.dart';
import '../models/training_progress.dart';
import '../services/training_service.dart';
import 'session_summary_screen.dart';
import 'training_views.dart';

// Highest efforts first: the usual 6–10 range is reachable at once.
final _rpeValues = [for (var v = 10.0; v >= 1; v -= .5) v];

class _Capture {
  _Capture(SetResult? result)
      : state = result?.state,
        rpe = result?.rpe,
        rir = result?.rir,
        reps = TextEditingController(
            text: result == null || result.state == 'not_performed'
                ? ''
                : '${result.reps}'),
        load = TextEditingController(
            text: result?.loadKg == null || result!.loadKg == 0
                ? ''
                : trainingDecimal(result.loadKg!));
  String? state, error;
  double? rpe;
  int? rir;
  final TextEditingController reps, load;
  double? get loadValue => double.tryParse(load.text.replaceAll(',', '.'));
  int? get repsValue => int.tryParse(reps.text);
  void dispose() {
    reps.dispose();
    load.dispose();
  }
}

class TrainingSessionScreen extends StatefulWidget {
  const TrainingSessionScreen(
      {super.key,
      required this.contextData,
      required this.service,
      this.history,
      this.settings = const AppSettings(),
      this.clock = DateTime.now,
      this.onShowProgress});
  final TrainingContext contextData;
  final TrainingService service;

  /// Own log used for "last time", suggestions and records. Optional.
  final TrainingHistory? history;
  final AppSettings settings;

  /// Injected for tests; wall time keeps timers right after backgrounding.
  final DateTime Function() clock;
  final VoidCallback? onShowProgress;
  @override
  State<TrainingSessionScreen> createState() => _TrainingSessionScreenState();
}

class _TrainingSessionScreenState extends State<TrainingSessionScreen> {
  final _captures = <String, _Capture>{};
  final _rpeMode = <String, bool>{};
  final _scroll = ScrollController();
  late TrainingContext _context;
  late String _id;
  late int _revision;
  late bool _finalized;
  late final DateTime _started = widget.clock();
  Timer? _ticker;
  int _current = 0, _restTotal = 0;
  DateTime? _restEnd;
  Duration? _restPaused;
  bool _dirty = false, _busy = false, _conflict = false, _compact = false;
  String? _error, _notice, _retryPayload, _retryKey;

  TrainingHistory get _history => widget.history ?? TrainingHistory.empty();
  List<TrainingExercise> get _exercises => _context.day!.exercises;

  @override
  void initState() {
    super.initState();
    _initialize(widget.contextData);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _initialize(TrainingContext context) {
    for (final capture in _captures.values) {
      capture.dispose();
    }
    _captures.clear();
    _context = context;
    _id = context.session?.id ?? trainingId();
    _revision = context.session?.revision ?? 0;
    _finalized = context.session?.status == 'finalized';
    _current = 0;
    for (final exercise in context.day!.exercises) {
      // Show the effort scale the professional prescribed; RIR otherwise.
      _rpeMode[exercise.id] = exercise.sets.any((s) => s.rpe != null) &&
          exercise.sets.every((s) => s.rir == null);
      for (final prescribed in exercise.sets) {
        SetResult? result;
        for (final candidate in context.session?.results ?? <SetResult>[]) {
          if (candidate.setId == prescribed.id) result = candidate;
        }
        _captures[prescribed.id] = _Capture(result);
      }
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    for (final capture in _captures.values) {
      capture.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  // ---- Timers -------------------------------------------------------------

  Duration? get _restLeft =>
      _restPaused ?? _restEnd?.difference(widget.clock());

  void _tick() {
    if (!mounted) return;
    final left = _restLeft;
    if (_restPaused == null && left != null && left <= Duration.zero) {
      _restEnd = null;
      if (widget.settings.haptics) HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(
            content: Text('Descanso terminado. ¡A por la siguiente serie!')));
    }
    setState(() {});
  }

  void _startRest(TrainingExercise e) {
    if (!widget.settings.restTimer) return;
    _restTotal = e.restSeconds ?? widget.settings.defaultRestSeconds;
    if (_restTotal == 0) return;
    _restPaused = null;
    _restEnd = widget.clock().add(Duration(seconds: _restTotal));
  }

  void _shiftRest(int seconds) => setState(() {
        final delta = Duration(seconds: seconds);
        _restTotal = (_restTotal + seconds).clamp(1, 3600);
        if (_restPaused != null) {
          _restPaused = _restPaused! + delta;
          if (_restPaused! <= Duration.zero) _restPaused = Duration.zero;
        } else if (_restEnd != null) {
          _restEnd = _restEnd!.add(delta);
        }
      });

  void _pauseRest() => setState(() {
        if (_restPaused != null) {
          _restEnd = widget.clock().add(_restPaused!);
          _restPaused = null;
        } else {
          _restPaused = _restLeft;
        }
      });

  void _skipRest() => setState(() {
        _restEnd = null;
        _restPaused = null;
      });

  // ---- Capture ------------------------------------------------------------

  void _touch(VoidCallback change) => setState(() {
        change();
        _dirty = true;
      });

  void _go(int index) {
    setState(() => _current = index);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  (String, HistoryExercise)? _last(TrainingExercise e) =>
      lastTime(_history, e.key, _context.localDate);

  SetResult? _lastSet(TrainingExercise e, int index) {
    final sets = _last(e)?.$2.sets;
    final s = sets != null && index < sets.length ? sets[index] : null;
    return s?.state == 'performed' ? s : null;
  }

  /// Hints, adopted when a set is checked with empty fields: last time's load
  /// for that set, else the prescribed load, else the previous set's load.
  (String, String) _suggest(TrainingExercise e, int index) {
    final prescribed = e.sets[index];
    final last = _lastSet(e, index)?.loadKg;
    final typed = index == 0 ? '' : _captures[e.sets[index - 1].id]!.load.text;
    final previous =
        index == 0 || typed.isNotEmpty ? typed : _suggest(e, index - 1).$1;
    final kg = last != null && last > 0
        ? trainingDecimal(last)
        : prescribed.targetLoadKg != null && prescribed.targetLoadKg! > 0
            ? trainingDecimal(prescribed.targetLoadKg!)
            : previous;
    // Matching last time's reps keeps the comparison honest; else the plan.
    return (kg, '${_lastSet(e, index)?.reps ?? prescribed.reps}');
  }

  /// Informative only; the prescribed load always wins over this hint.
  String? _progression(TrainingExercise e) {
    final last = _last(e);
    if (last == null || e.bodyweight) return null;
    if (e.sets.any((s) => s.targetLoadKg != null)) {
      return 'Tu profesional indicó la carga de cada serie.';
    }
    final sets = last.$2.sets;
    final hitAll = sets.length >= e.sets.length &&
        e.sets.asMap().entries.every((entry) {
          final s = sets[entry.key];
          return s?.state == 'performed' &&
              s!.reps >= (entry.value.repsMax ?? entry.value.reps);
        });
    return hitAll
        ? 'La vez pasada completaste todas las reps. Si te sientes bien, prueba +${trainingDecimal(widget.settings.loadStep)} kg.'
        : 'Intenta igualar o superar lo de la vez pasada.';
  }

  String? _invalid(TrainingExercise e, _Capture c) {
    final reps = c.repsValue;
    if (reps == null || reps < 1 || reps > 1000) return 'Reps de 1 a 1000';
    if (e.bodyweight) return null;
    final kg = c.loadValue;
    return kg == null ||
            !kg.isFinite ||
            kg <= 0 ||
            kg > 1000 ||
            (kg * 10 - (kg * 10).round()).abs() > .00001
        ? 'Kg de 0,1 a 1000'
        : null;
  }

  void _toggle(TrainingExercise e, int index) {
    final c = _captures[e.sets[index].id]!;
    if (c.state == 'performed') {
      _touch(() => c.state = null);
      return;
    }
    final (kg, reps) = _suggest(e, index);
    _touch(() {
      if (c.load.text.isEmpty && !e.bodyweight) c.load.text = kg;
      if (c.reps.text.isEmpty) c.reps.text = reps;
      c.error = _invalid(e, c);
      if (c.error != null) return;
      c.state = 'performed';
      if (_captures.values.any((c) => c.state == null)) _startRest(e);
    });
  }

  void _step(TextEditingController controller, String hint, double step,
      {required bool decimal}) {
    final base = double.tryParse(
            (controller.text.isEmpty ? hint : controller.text)
                .replaceAll(',', '.')) ??
        0;
    final next = (base + step).clamp(decimal ? 0.0 : 1.0, 1000.0);
    controller.text = decimal
        ? trainingDecimal(double.parse(next.toStringAsFixed(2)))
        : '${next.round()}';
  }

  Future<bool> _leave() async {
    if (_busy) return false;
    if (!_dirty) return true;
    return await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
                    title: const Text('Hay cambios sin guardar'),
                    content: const Text(
                        'Tu captura todavía no se ha confirmado. Puedes volver y guardarla.'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Seguir aquí')),
                      TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Descartar y salir'))
                    ])) ??
        false;
  }

  Iterable<_Capture> _done(TrainingExercise e) =>
      e.sets.map((s) => _captures[s.id]!).where((c) => c.state == 'performed');

  double get _volume {
    var total = 0.0;
    for (final e in _exercises.where((e) => !e.bodyweight)) {
      for (final c in _done(e)) {
        total += (c.repsValue ?? 0) * (c.loadValue ?? 0);
      }
    }
    return total;
  }

  double _todayBest(TrainingExercise e) => _done(e)
      .map((c) =>
          e.bodyweight ? (c.repsValue ?? 0).toDouble() : c.loadValue ?? 0)
      .fold<double>(0, (a, b) => a > b ? a : b);

  bool _isRecord(TrainingExercise e) {
    final before =
        bestBefore(_history, e.key, e.bodyweight, _context.localDate);
    return before != null && _todayBest(e) > before;
  }

  List<SummaryExercise> _summary() => [
        for (final e in _exercises)
          () {
            _Capture? top;
            for (final c in _done(e)) {
              if (top == null ||
                  (e.bodyweight
                      ? (c.repsValue ?? 0) > (top.repsValue ?? 0)
                      : (c.loadValue ?? 0) > (top.loadValue ?? 0))) {
                top = c;
              }
            }
            final last = _last(e);
            final lastTop = last == null ? null : topSet(last.$2);
            String? change;
            if (top != null && lastTop != null) {
              change = _difference(
                  e.bodyweight,
                  (top.repsValue ?? 0) - lastTop.reps,
                  (top.loadValue ?? 0) - (lastTop.loadKg ?? 0));
            }
            return SummaryExercise(
                e.name,
                top == null
                    ? null
                    : e.bodyweight
                        ? '${top.repsValue} reps'
                        : '${trainingDecimal(top.loadValue!)} kg × ${top.repsValue}',
                change,
                _isRecord(e));
          }()
      ];

  List<MapEntry<String, int>> _groups() {
    final sets = <String, int>{};
    for (final e in _exercises) {
      for (final g in muscleGroups(e.muscles, e.bodyPart)) {
        sets[g] = (sets[g] ?? 0) + _done(e).length;
      }
    }
    return sets.entries.where((e) => e.value > 0).toList()
      ..sort((a, b) => b.value - a.value);
  }

  Future<void> _save(bool finalize) async {
    for (final entry in _exercises.asMap().entries) {
      for (final s in entry.value.sets) {
        final c = _captures[s.id]!;
        if (c.state != 'performed') continue;
        c.error = _invalid(entry.value, c);
        if (c.error != null) {
          setState(() => _error = 'Revisa la serie marcada en rojo.');
          _go(entry.key);
          return;
        }
      }
    }
    if (finalize) {
      final pending = _exercises
          .indexWhere((e) => e.sets.any((s) => _captures[s.id]!.state == null));
      if (pending >= 0) {
        setState(() => _error =
            'Marca cada serie como hecha (✓) o «No la hice» antes de finalizar.');
        _go(pending);
        return;
      }
    }
    final results = <Map<String, Object?>>[];
    for (final exercise in _exercises) {
      for (final prescribed in exercise.sets) {
        final capture = _captures[prescribed.id]!;
        if (capture.state == null) continue;
        final done = capture.state == 'performed';
        results.add({
          'setId': prescribed.id,
          'state': capture.state,
          'reps': done ? capture.repsValue : 0,
          'loadKg': !done
              ? null
              : exercise.bodyweight
                  ? 0
                  : capture.loadValue,
          'rpe': done ? capture.rpe : null,
          'rir': done ? capture.rir : null,
        });
      }
    }
    final wasFinalized = _finalized;
    final body = <String, Object?>{
      'id': _id,
      'localDate': _context.localDate,
      'versionId': _context.plan!.id,
      'revision': _revision,
      'status': finalize || _finalized ? 'finalized' : 'draft',
      'results': results
    };
    final serialized = jsonEncode(body);
    if (_retryPayload != serialized) {
      _retryPayload = serialized;
      _retryKey = trainingId();
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      final session = await widget.service.save(body, _retryKey!);
      if (!mounted) return;
      setState(() {
        _revision = session.revision;
        _finalized = session.status == 'finalized';
        _dirty = false;
        _retryKey = null;
        _retryPayload = null;
        _notice = _finalized
            ? 'Corrección guardada.'
            : 'Avance guardado. Puedes continuar después.';
      });
      if (_finalized && !wasFinalized) {
        await Navigator.pushReplacement(
            context,
            MaterialPageRoute<void>(
                builder: (_) => SessionSummaryScreen(
                    dayName: _context.day!.name,
                    date: _context.localDate,
                    duration: widget.clock().difference(_started),
                    sets:
                        results.where((r) => r['state'] == 'performed').length,
                    volume: _volume,
                    exercises: _summary(),
                    groups: _groups(),
                    onShowProgress: widget.onShowProgress)));
        return;
      }
      if (_scroll.hasClients) _scroll.jumpTo(0);
    } catch (error) {
      if (TrainingService.denied(error)) await widget.service.cache.clear();
      if (!mounted) return;
      setState(() {
        _conflict = error is AuthApiException && error.statusCode == 409;
        _error = _conflict
            ? 'Este registro cambió en otro dispositivo. Tu captura sigue aquí; revisa lo guardado antes de continuar.'
            : error is AuthApiException
                ? error.message
                : 'No pudimos confirmar el guardado. Conservamos tu captura; reintenta con conexión.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reviewConflict() async {
    setState(() => _busy = true);
    try {
      final server = await widget.service.context(date: _context.localDate);
      if (!mounted) return;
      final saved = server.session;
      final summary = saved == null
          ? 'Aún no hay nada guardado para esta fecha.'
          : '${saved.status == 'finalized' ? 'Finalizado' : 'En progreso'} · ${saved.results.length} series registradas\n\n${server.day!.exercises.map((e) => '${e.name}\n${e.sets.asMap().entries.map((entry) {
                final matching =
                    saved.results.where((r) => r.setId == entry.value.id);
                return 'Serie ${entry.key + 1}: ${matching.isEmpty ? 'pendiente' : setLabel(matching.first)}';
              }).join('\n')}').join('\n\n')}';
      final replace = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
                  title: const Text('Registro guardado'),
                  content: SingleChildScrollView(child: Text(summary)),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Conservar mi captura')),
                    TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Usar lo guardado'))
                  ]));
      if (replace == true && mounted) {
        setState(() {
          _initialize(server);
          _dirty = false;
          _conflict = false;
          _error = null;
          _retryPayload = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error is AuthApiException
            ? error.message
            : 'No pudimos consultar el registro.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ---- Layout -------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final day = _context.day!;
    final colors = Theme.of(context).colorScheme;
    final marked = _captures.values.where((c) => c.state != null).length;
    final isToday = _context.localDate == _context.today;
    return PopScope(
        canPop: !_dirty && !_busy,
        onPopInvokedWithResult: (didPop, result) async {
          if (!didPop && await _leave() && context.mounted) {
            setState(() => _dirty = false);
            if (context.mounted) Navigator.pop(context);
          }
        },
        child: Scaffold(
            appBar: AppBar(
                leading: IconButton(
                    tooltip: 'Salir del registro',
                    icon: const Icon(Icons.keyboard_arrow_down_rounded),
                    onPressed: () => Navigator.maybePop(context)),
                titleSpacing: 0,
                title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(day.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 17, fontWeight: FontWeight.w800)),
                      Text(
                          [
                            if (isToday)
                              clockLabel(widget.clock().difference(_started))
                            else
                              shortDate(_context.localDate),
                            '$marked/${_captures.length} series',
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 13, color: colors.onSurfaceVariant)),
                    ]),
                actions: [
                  Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: BrandColors.success,
                              foregroundColor: const Color(0xFF052E22),
                              shape: const StadiumBorder()),
                          onPressed:
                              _busy || _conflict ? null : () => _save(true),
                          child: Text(_finalized ? 'Corregir' : 'Finalizar',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800)))),
                ]),
            body: SafeArea(
                child: ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    children: [
                  Center(
                      child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 560),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _progress(marked),
                                if (_finalized)
                                  const TrainingNotice(
                                      icon: Icons.check_circle_outline,
                                      text:
                                          'Entrenamiento finalizado. Si corriges algo, se guarda como corrección.'),
                                if (_error != null)
                                  TrainingNotice(text: _error!, error: true),
                                if (_notice != null)
                                  TrainingNotice(
                                      icon: Icons.check_circle_outline,
                                      text: _notice!),
                                if (_conflict)
                                  OutlinedButton(
                                      onPressed: _busy ? null : _reviewConflict,
                                      child: const Text('Ver lo guardado')),
                                if (_exercises.length > 1) _exerciseChips(),
                                _exercise(_exercises[_current]),
                                const SizedBox(height: 12),
                                Text(
                                    'Una serie sin marcar queda pendiente; no cuenta como cero. Necesitas conexión para guardar.',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: colors.onSurfaceVariant)),
                              ])))
                ])),
            bottomNavigationBar:
                _restLeft != null ? _restBar() : _actionBar()));
  }

  Widget _progress(int marked) {
    final colors = Theme.of(context).colorScheme;
    final total = _captures.length;
    return Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(children: [
          Expanded(
              child: Semantics(
                  label:
                      '$marked de ${trainingCount(total, 'serie registrada', 'series registradas')}',
                  child: ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                          minHeight: 8,
                          value: total == 0 ? 0 : marked / total,
                          color: BrandColors.success,
                          backgroundColor: colors.surfaceContainerHighest)))),
          const SizedBox(width: 12),
          Text('${trainingThousands(_volume)} kg',
              style: TextStyle(
                  fontWeight: FontWeight.w700, color: colors.onSurfaceVariant)),
        ]));
  }

  Widget _exerciseChips() {
    final colors = Theme.of(context).colorScheme;
    return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          for (final entry in _exercises.asMap().entries)
            Builder(builder: (context) {
              final sets = entry.value.sets.map((s) => _captures[s.id]!);
              final complete = sets.every((c) => c.state != null);
              final current = entry.key == _current;
              return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Semantics(
                      button: true,
                      selected: current,
                      label:
                          'Ejercicio ${entry.key + 1}: ${entry.value.name}${complete ? ', completo' : ''}',
                      child: ExcludeSemantics(
                          child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () => _go(entry.key),
                              child: Container(
                                  width: 44,
                                  height: 44,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: complete
                                          ? BrandColors.success
                                          : current
                                              ? colors.primary
                                              : colors.surfaceContainerHighest,
                                      border: current && complete
                                          ? Border.all(
                                              color: colors.onSurface, width: 2)
                                          : null),
                                  child: complete
                                      ? const Icon(Icons.check,
                                          color: Colors.white, size: 20)
                                      : Text('${entry.key + 1}',
                                          style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              color: current
                                                  ? colors.onPrimary
                                                  : colors.onSurface)))))));
            }),
        ]));
  }

  Widget _exercise(TrainingExercise exercise) {
    final colors = Theme.of(context).colorScheme;
    final last = _last(exercise);
    final best = bestBefore(
        _history, exercise.key, exercise.bodyweight, _context.localDate);
    final hint = _progression(exercise);
    final groups = muscleGroups(exercise.muscles, exercise.bodyPart);
    void detail() => Navigator.push(
        context,
        MaterialPageRoute<void>(
            builder: (_) => ExerciseDetailScreen(exercise: exercise)));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (!_compact)
        ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(children: [
              Container(
                  color: exercise.images.isEmpty
                      ? colors.surfaceContainerHighest
                      : Colors.white,
                  alignment: Alignment.center,
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 300),
                      child: ExerciseAnimation(
                          images: exercise.images, label: exercise.name))),
              Positioned(
                  left: 10,
                  bottom: 10,
                  child: _overlayButton(Icons.close_fullscreen, 'Minimizar',
                      () => setState(() => _compact = true))),
              Positioned(
                  right: 10,
                  bottom: 10,
                  child: _overlayButton(
                      Icons.menu_book_outlined, 'Técnica', detail)),
            ])),
      const SizedBox(height: 14),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (_compact) ...[
          InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() => _compact = false),
              child: ExerciseAnimation(
                  images: exercise.images, label: exercise.name, size: 56)),
          const SizedBox(width: 12),
        ],
        Expanded(
            child: Text(exercise.name,
                style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3))),
        IconButton.filledTonal(
            tooltip: _compact ? 'Mostrar demostración' : 'Ver técnica',
            onPressed:
                _compact ? () => setState(() => _compact = false) : detail,
            icon: Icon(_compact ? Icons.open_in_full : Icons.info_outline)),
      ]),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final g in groups.take(3)) TrainingChip(g),
        if (exercise.equipment.isNotEmpty)
          TrainingChip(exercise.equipment.first)
        else
          TrainingChip(exercise.bodyweight ? 'Peso corporal' : 'Con carga'),
        if (exercise.restLabel != null)
          TrainingChip(exercise.restLabel!, icon: Icons.timer_outlined),
        if (best != null)
          TrainingChip(
              'Mejor: ${exercise.bodyweight ? '${best.round()} reps' : '${trainingDecimal(best)} kg'}',
              icon: Icons.emoji_events_outlined),
      ]),
      const SizedBox(height: 10),
      Text('Plan: ${exercise.summary}',
          style: TextStyle(color: colors.onSurfaceVariant)),
      if (last != null)
        Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
                'La última vez (${shortDate(last.$1)}): ${last.$2.sets.whereType<SetResult>().map(setShort).join(', ')}',
                style: TextStyle(color: colors.onSurfaceVariant))),
      if (hint != null)
        Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.trending_up,
                  size: 18, color: BrandColors.success),
              const SizedBox(width: 6),
              Expanded(
                  child: Text(hint,
                      style: const TextStyle(
                          color: BrandColors.success,
                          fontWeight: FontWeight.w700))),
            ])),
      if (exercise.instructions.isNotEmpty)
        Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(exercise.instructions,
                style: TextStyle(
                    fontStyle: FontStyle.italic,
                    color: colors.onSurfaceVariant))),
      const SizedBox(height: 14),
      _setsCard(exercise),
    ]);
  }

  Widget _overlayButton(IconData icon, String label, VoidCallback onTap) =>
      Material(
          color: Colors.black.withValues(alpha: .55),
          shape: const StadiumBorder(),
          child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: onTap,
              child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(icon, size: 16, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(label,
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w600)),
                  ]))));

  Widget _setsCard(TrainingExercise exercise) {
    final colors = Theme.of(context).colorScheme;
    final rpe = _rpeMode[exercise.id]!;
    return Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
        decoration: BoxDecoration(
            color: colors.surfaceContainerHighest.withValues(alpha: .55),
            borderRadius: BorderRadius.circular(18)),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const SizedBox(width: 36),
            if (!exercise.bodyweight) ...[
              Expanded(child: _columnTitle('KG')),
              const SizedBox(width: 8),
            ],
            Expanded(child: _columnTitle('REPS')),
          ]),
          for (var i = 0; i < exercise.sets.length; i++) _setRow(exercise, i),
          const SizedBox(height: 8),
          Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              runSpacing: 4,
              children: [
                TextButton.icon(
                    key: ValueKey('effort-mode-${exercise.id}'),
                    onPressed: () =>
                        setState(() => _rpeMode[exercise.id] = !rpe),
                    icon: const Icon(Icons.swap_vert, size: 18),
                    label: Text(rpe
                        ? 'Esfuerzo en RPE · cambiar a RIR'
                        : 'Esfuerzo en RIR · cambiar a RPE')),
                if (_current < _exercises.length - 1)
                  TextButton.icon(
                      onPressed: () => _go(_current + 1),
                      icon: const Icon(Icons.skip_next_rounded),
                      label: const Text('Siguiente ejercicio')),
              ]),
          if (_captures.values.every((c) => c.state == null))
            Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                    'Ajusta kg y reps con − / + o escribe, y toca ✓ al terminar cada serie. Si dejas un campo vacío usamos la sugerencia gris.',
                    style: TextStyle(
                        fontSize: 12.5, color: colors.onSurfaceVariant))),
        ]));
  }

  Widget _columnTitle(String text) => Text(text,
      textAlign: TextAlign.center,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
          fontSize: 12,
          letterSpacing: 1,
          fontWeight: FontWeight.w800,
          color: Theme.of(context).colorScheme.onSurfaceVariant));

  Widget _stepper(
      {required Key key,
      required TextEditingController controller,
      required String hint,
      required String label,
      required bool decimal,
      required double step,
      required bool enabled,
      required _Capture capture}) {
    final colors = Theme.of(context).colorScheme;
    final field = Semantics(
        label: label,
        child: TextField(
            key: key,
            controller: controller,
            enabled: enabled,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            decoration: InputDecoration(
                isDense: true,
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                hintText: hint,
                contentPadding: const EdgeInsets.symmetric(vertical: 12)),
            keyboardType: TextInputType.numberWithOptions(decimal: decimal),
            inputFormatters: [
              FilteringTextInputFormatter.allow(
                  RegExp(decimal ? r'[0-9.,]' : r'[0-9]'))
            ],
            onChanged: (_) => _touch(() => capture.error = null)));
    Widget button(IconData icon, String tip, double delta) => SizedBox(
        width: 36,
        height: 48,
        child: IconButton(
            tooltip: '$tip $label',
            padding: EdgeInsets.zero,
            onPressed: enabled
                ? () => _touch(() {
                      _step(controller, hint, delta, decimal: decimal);
                      capture.error = null;
                    })
                : null,
            icon: Icon(icon, size: 20)));
    return Container(
        decoration: BoxDecoration(
            color: colors.surface, borderRadius: BorderRadius.circular(12)),
        child: LayoutBuilder(
            builder: (context, c) => c.maxWidth < 112
                ? field
                : Row(children: [
                    button(Icons.remove, 'Restar a', -step),
                    Expanded(child: field),
                    button(Icons.add, 'Sumar a', step),
                  ])));
  }

  Widget _setRow(TrainingExercise e, int index) {
    final prescribed = e.sets[index];
    final c = _captures[prescribed.id]!;
    final colors = Theme.of(context).colorScheme;
    final done = c.state == 'performed', skipped = c.state == 'not_performed';
    final (kgHint, repsHint) = _suggest(e, index);
    final rpe = _rpeMode[e.id]!;
    final effort = rpe
        ? (c.rpe == null ? null : trainingDecimal(c.rpe!))
        : c.rir?.toString();
    final comparison = done ? _comparison(e, index, c) : null;
    final editable = !_busy && !skipped;
    return Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: done
                ? BrandColors.success.withValues(alpha: .14)
                : skipped
                    ? colors.surfaceContainerHighest
                    : null,
            border: Border.all(
                color: c.error != null
                    ? colors.error
                    : done
                        ? BrandColors.success.withValues(alpha: .6)
                        : Colors.transparent)),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            SizedBox(
                width: 32,
                child: CircleAvatar(
                    radius: 13,
                    backgroundColor:
                        done ? BrandColors.success : colors.surface,
                    foregroundColor: done ? Colors.white : colors.onSurface,
                    child: Text('${index + 1}',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 4),
            if (!e.bodyweight) ...[
              Expanded(
                  child: _stepper(
                      key: ValueKey('kg-${prescribed.id}'),
                      controller: c.load,
                      hint: kgHint.isEmpty ? 'kg' : kgHint,
                      label: 'kg de la serie ${index + 1}',
                      decimal: true,
                      step: widget.settings.loadStep,
                      enabled: editable,
                      capture: c)),
              const SizedBox(width: 8),
            ],
            Expanded(
                child: _stepper(
                    key: ValueKey('reps-${prescribed.id}'),
                    controller: c.reps,
                    hint: repsHint,
                    label: 'reps de la serie ${index + 1}',
                    decimal: false,
                    step: 1,
                    enabled: editable,
                    capture: c)),
          ]),
          Padding(
              padding: const EdgeInsets.only(left: 36, top: 6),
              child: Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  runSpacing: 4,
                  children: [
                    Semantics(
                        button: true,
                        label:
                            '${rpe ? 'RPE' : 'RIR'} de la serie ${index + 1}: ${effort ?? 'sin dato'}',
                        child: ExcludeSemantics(
                            child: OutlinedButton(
                                key: ValueKey('effort-${prescribed.id}'),
                                style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(76, 44),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10),
                                    foregroundColor: colors.onSurface),
                                onPressed:
                                    editable ? () => _pickEffort(e, c) : null,
                                child: Text(
                                    '${rpe ? 'RPE' : 'RIR'} ${effort ?? '—'}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700))))),
                    Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (!done)
                            TextButton(
                                key: ValueKey('skip-${prescribed.id}'),
                                style: TextButton.styleFrom(
                                    minimumSize: const Size(48, 44),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8)),
                                onPressed: _busy
                                    ? null
                                    : () => _touch(() {
                                          c.state =
                                              skipped ? null : 'not_performed';
                                          c.error = null;
                                        }),
                                child: Text(skipped ? 'Deshacer' : 'No la hice',
                                    style: const TextStyle(fontSize: 13))),
                          done
                              ? IconButton.filled(
                                  key: ValueKey('check-${prescribed.id}'),
                                  tooltip: 'Desmarcar serie ${index + 1}',
                                  style: IconButton.styleFrom(
                                      backgroundColor: BrandColors.success,
                                      foregroundColor: Colors.white),
                                  onPressed:
                                      _busy ? null : () => _toggle(e, index),
                                  icon: const Icon(Icons.check))
                              : IconButton.outlined(
                                  key: ValueKey('check-${prescribed.id}'),
                                  tooltip:
                                      'Marcar serie ${index + 1} como hecha',
                                  onPressed: _busy || skipped
                                      ? null
                                      : () => _toggle(e, index),
                                  icon: const Icon(Icons.check)),
                        ]),
                  ])),
          Padding(
              padding: const EdgeInsets.only(left: 36, top: 2),
              child: Text.rich(
                  TextSpan(children: [
                    TextSpan(
                        text: c.error ??
                            (skipped
                                ? 'No hecha · sin reps ni carga'
                                : 'Objetivo: ${prescribed.target}')),
                    if (comparison != null)
                      TextSpan(
                          text: '  $comparison',
                          style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: comparison.startsWith('+')
                                  ? BrandColors.success
                                  : colors.onSurfaceVariant)),
                  ]),
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight:
                          c.error != null ? FontWeight.w700 : FontWeight.w400,
                      color: c.error != null
                          ? colors.error
                          : colors.onSurfaceVariant))),
        ]));
  }

  String _difference(bool bodyweight, int reps, double kg) {
    String signed(num v, String unit) =>
        '${v > 0 ? '+' : '−'}${trainingDecimal(double.parse(v.abs().toStringAsFixed(1)))} $unit';
    if (!bodyweight && kg.abs() >= .05) return signed(kg, 'kg');
    if (reps != 0) return signed(reps, reps.abs() == 1 ? 'rep' : 'reps');
    return '= última vez';
  }

  /// "+2,5 kg", "−1 rep" or "= última vez" against the same set last time.
  String? _comparison(TrainingExercise e, int index, _Capture c) {
    final last = _lastSet(e, index);
    if (last == null) return null;
    return _difference(e.bodyweight, (c.repsValue ?? 0) - last.reps,
        (c.loadValue ?? 0) - (last.loadKg ?? 0));
  }

  Future<void> _pickEffort(TrainingExercise e, _Capture c) async {
    final rpe = _rpeMode[e.id]!;
    final values =
        rpe ? _rpeValues : [for (var v = 0; v <= 10; v++) v.toDouble()];
    final current = rpe ? c.rpe : c.rir?.toDouble();
    // -1 means "sin dato"; null means the sheet was dismissed.
    final picked = await showModalBottomSheet<double>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (context) => SafeArea(
            child: SingleChildScrollView(
                child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                    child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                              rpe
                                  ? 'RPE · esfuerzo percibido (10 = máximo)'
                                  : 'RIR · repeticiones que te quedaban en reserva',
                              style: const TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 14),
                          Wrap(spacing: 8, runSpacing: 8, children: [
                            for (final v in values)
                              ChoiceChip(
                                  label: Text(rpe
                                      ? trainingDecimal(v)
                                      : '${v.toInt()}'),
                                  selected: current == v,
                                  onSelected: (_) => Navigator.pop(context, v)),
                          ]),
                          const SizedBox(height: 12),
                          TextButton(
                              onPressed: () => Navigator.pop(context, -1),
                              child: const Text('Sin dato')),
                        ])))));
    if (picked == null || !mounted) return;
    _touch(() {
      final value = picked < 0 ? null : picked;
      if (rpe) {
        c.rpe = value;
      } else {
        c.rir = value?.toInt();
      }
    });
  }

  Widget _barShell(Widget child) => SafeArea(
      top: false,
      child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              border: Border(
                  top: BorderSide(
                      color: Theme.of(context).colorScheme.outlineVariant))),
          child: Center(
              // heightFactor keeps the bar as tall as its content.
              heightFactor: 1,
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: child))));

  Widget _actionBar() {
    final last = _current == _exercises.length - 1;
    return _barShell(Row(children: [
      Expanded(
          child: OutlinedButton(
              onPressed: _busy || _conflict ? null : () => _save(false),
              child: Text(_busy
                  ? 'Guardando…'
                  : _finalized
                      ? 'Guardar corrección'
                      : 'Guardar avance'))),
      const SizedBox(width: 10),
      Expanded(
          child: last
              ? FilledButton(
                  onPressed: _busy || _conflict || _finalized
                      ? null
                      : () => _save(true),
                  child: const Text('Finalizar entrenamiento',
                      textAlign: TextAlign.center))
              : FilledButton.icon(
                  onPressed: () => _go(_current + 1),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: const Text('Siguiente'))),
    ]));
  }

  Widget _restBar() {
    final colors = Theme.of(context).colorScheme;
    final left = _restLeft! < Duration.zero ? Duration.zero : _restLeft!;
    final paused = _restPaused != null;
    return _barShell(Column(mainAxisSize: MainAxisSize.min, children: [
      ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
              minHeight: 4,
              value: _restTotal == 0
                  ? 0
                  : (left.inSeconds / _restTotal).clamp(0, 1).toDouble(),
              color: BrandColors.success,
              backgroundColor: colors.surfaceContainerHighest)),
      const SizedBox(height: 8),
      Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            Semantics(
                liveRegion: true,
                label: 'Descanso: ${clockLabel(left)} restantes',
                child: ExcludeSemantics(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                      Text(clockLabel(left),
                          key: const ValueKey('rest-left'),
                          style: const TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.w800,
                              fontFeatures: [FontFeature.tabularFigures()])),
                      Text(paused ? 'Descanso en pausa' : 'Descanso',
                          style: TextStyle(color: colors.onSurfaceVariant)),
                    ]))),
            Row(mainAxisSize: MainAxisSize.min, children: [
              OutlinedButton(
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(56, 48),
                      padding: const EdgeInsets.symmetric(horizontal: 8)),
                  onPressed: () => _shiftRest(-15),
                  child: const Text('−15 s')),
              const SizedBox(width: 6),
              OutlinedButton(
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(56, 48),
                      padding: const EdgeInsets.symmetric(horizontal: 8)),
                  onPressed: () => _shiftRest(15),
                  child: const Text('+15 s')),
              const SizedBox(width: 6),
              IconButton.outlined(
                  tooltip: paused ? 'Reanudar descanso' : 'Pausar descanso',
                  onPressed: _pauseRest,
                  icon: Icon(paused ? Icons.play_arrow : Icons.pause)),
              const SizedBox(width: 6),
              FilledButton(
                  style: FilledButton.styleFrom(
                      backgroundColor: BrandColors.success,
                      foregroundColor: const Color(0xFF052E22)),
                  onPressed: _skipRest,
                  child: const Text('Saltar',
                      style: TextStyle(fontWeight: FontWeight.w800))),
            ]),
          ]),
    ]));
  }
}

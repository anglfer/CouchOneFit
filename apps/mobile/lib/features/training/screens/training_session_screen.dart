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
  final _exerciseKeys = <String, GlobalKey>{};
  int _restTotal = 0;
  DateTime? _restEnd;
  Duration? _restPaused;
  bool _dirty = false, _busy = false, _conflict = false;
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

  /// Scrolls the exercise into view (the list shows all of them, Hevy-style).
  void _go(int index) {
    final target = _exerciseKeys[_exercises[index].id]?.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(target,
          duration: const Duration(milliseconds: 250));
    }
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
                          isToday
                              ? 'Registro de hoy'
                              : capitalized(longDate(_context.localDate)),
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
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                    children: [
                  Center(
                      child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 560),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _stats(isToday),
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
                                for (final e in _exercises) _exercise(e),
                                Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4),
                                    child: Text(
                                        'Toca ✓ al terminar cada serie; si dejas un campo vacío usamos el valor gris. Toca ANTERIOR para copiar lo de la vez pasada y el número de serie para más opciones. Una serie sin marcar queda pendiente, no cuenta como cero. Necesitas conexión para guardar.',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: colors.onSurfaceVariant))),
                              ])))
                ])),
            bottomNavigationBar:
                _restLeft != null ? _restBar() : _actionBar()));
  }

  /// Hevy-style live numbers: duration, volume and marked sets.
  Widget _stats(bool isToday) {
    final colors = Theme.of(context).colorScheme;
    final total = _captures.length;
    final marked = _captures.values.where((c) => c.state != null).length;
    Widget stat(String label, String value, {Key? key}) => Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
          const SizedBox(height: 2),
          FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value,
                  key: key,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      fontFeatures: [FontFeature.tabularFigures()]))),
        ]));
    return Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            if (isToday)
              stat('Duración', clockLabel(widget.clock().difference(_started)))
            else
              stat('Fecha', shortDate(_context.localDate)),
            stat('Volumen', '${trainingThousands(_volume)} kg'),
            Semantics(
                label:
                    '$marked de ${trainingCount(total, 'serie registrada', 'series registradas')}',
                child: ExcludeSemantics(
                    child: SizedBox(
                        width: 84,
                        child: Row(children: [
                          stat('Series', '$marked/$total',
                              key: const ValueKey('sets-marked')),
                        ])))),
          ]),
          const SizedBox(height: 10),
          ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                  minHeight: 6,
                  value: total == 0 ? 0 : marked / total,
                  color: BrandColors.success,
                  backgroundColor: colors.surfaceContainerHighest)),
        ]));
  }

  Widget _exercise(TrainingExercise exercise) {
    final colors = Theme.of(context).colorScheme;
    final last = _last(exercise);
    final best = bestBefore(
        _history, exercise.key, exercise.bodyweight, _context.localDate);
    final hint = _progression(exercise);
    final groups = muscleGroups(exercise.muscles, exercise.bodyPart);
    final complete = exercise.sets.every((s) => _captures[s.id]!.state != null);
    final rpe = _rpeMode[exercise.id]!;
    void detail() => Navigator.push(
        context,
        MaterialPageRoute<void>(
            builder: (_) => ExerciseDetailScreen(exercise: exercise)));
    return Card(
        key: _exerciseKeys.putIfAbsent(exercise.id, GlobalKey.new),
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: detail,
                        child: ExerciseAnimation(
                            images: exercise.images,
                            label: exercise.name,
                            size: 48)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(exercise.name,
                              style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: colors.primary)),
                          Text(
                              [
                                ...groups.take(2),
                                if (exercise.equipment.isNotEmpty)
                                  exercise.equipment.first
                                else
                                  exercise.bodyweight
                                      ? 'Peso corporal'
                                      : 'Con carga',
                              ].join(' · '),
                              style: TextStyle(
                                  fontSize: 13,
                                  color: colors.onSurfaceVariant)),
                        ])),
                    if (complete)
                      const Padding(
                          padding: EdgeInsets.only(left: 4),
                          child: Icon(Icons.check_circle,
                              color: BrandColors.success,
                              semanticLabel: 'Ejercicio completo')),
                    IconButton(
                        tooltip: 'Ver técnica',
                        onPressed: detail,
                        icon: const Icon(Icons.info_outline)),
                  ]),
                  if (exercise.instructions.isNotEmpty)
                    Container(
                        margin: const EdgeInsets.only(top: 10),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: colors.primaryContainer,
                            borderRadius: BorderRadius.circular(10)),
                        child: Text(exercise.instructions,
                            style: TextStyle(
                                fontStyle: FontStyle.italic,
                                color: colors.onPrimaryContainer))),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    TrainingChip(exercise.summary, icon: Icons.flag_outlined),
                    if (exercise.restLabel != null)
                      TrainingChip(exercise.restLabel!,
                          icon: Icons.timer_outlined),
                    if (best != null)
                      TrainingChip(
                          'Mejor: ${exercise.bodyweight ? '${best.round()} reps' : '${trainingDecimal(best)} kg'}',
                          icon: Icons.emoji_events_outlined),
                    if (last != null)
                      TrainingChip('Última vez: ${shortDate(last.$1)}',
                          icon: Icons.history),
                  ]),
                  if (hint != null)
                    Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.trending_up,
                                  size: 18, color: BrandColors.success),
                              const SizedBox(width: 6),
                              Expanded(
                                  child: Text(hint,
                                      style: const TextStyle(
                                          color: BrandColors.success,
                                          fontWeight: FontWeight.w700))),
                            ])),
                  const SizedBox(height: 12),
                  _tableRow(
                      set: _columnTitle('SERIE'),
                      previous: _columnTitle('ANTERIOR'),
                      kg: exercise.bodyweight ? null : _columnTitle('KG'),
                      reps: _columnTitle('REPS'),
                      check: const Icon(Icons.check, size: 18)),
                  for (var i = 0; i < exercise.sets.length; i++)
                    _setRow(exercise, i),
                  Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                          key: ValueKey('effort-mode-${exercise.id}'),
                          onPressed: () =>
                              setState(() => _rpeMode[exercise.id] = !rpe),
                          icon: const Icon(Icons.swap_vert, size: 18),
                          label: Text(rpe
                              ? 'Esfuerzo en RPE · cambiar a RIR'
                              : 'Esfuerzo en RIR · cambiar a RPE'))),
                ])));
  }

  /// Shared column widths so the header lines up with every set row.
  Widget _tableRow(
          {required Widget set,
          required Widget previous,
          required Widget? kg,
          required Widget reps,
          required Widget check}) =>
      Row(children: [
        SizedBox(width: 36, child: Center(child: set)),
        const SizedBox(width: 4),
        Expanded(flex: 4, child: previous),
        if (kg != null) ...[
          const SizedBox(width: 6),
          Expanded(flex: 5, child: kg),
        ],
        const SizedBox(width: 6),
        Expanded(flex: 5, child: reps),
        const SizedBox(width: 6),
        SizedBox(width: 44, child: Center(child: check)),
      ]);

  Widget _columnTitle(String text) => Text(text,
      textAlign: TextAlign.center,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
          fontSize: 11,
          letterSpacing: .8,
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
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            decoration: InputDecoration(
                isDense: true,
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                hintText: hint,
                contentPadding: const EdgeInsets.symmetric(vertical: 10)),
            keyboardType: TextInputType.numberWithOptions(decimal: decimal),
            inputFormatters: [
              FilteringTextInputFormatter.allow(
                  RegExp(decimal ? r'[0-9.,]' : r'[0-9]'))
            ],
            onChanged: (_) => _touch(() => capture.error = null)));
    Widget button(IconData icon, String tip, double delta) => SizedBox(
        width: 32,
        height: 44,
        child: IconButton(
            tooltip: '$tip $label',
            padding: EdgeInsets.zero,
            onPressed: enabled
                ? () => _touch(() {
                      _step(controller, hint, delta, decimal: decimal);
                      capture.error = null;
                    })
                : null,
            icon: Icon(icon, size: 18)));
    return Container(
        decoration: BoxDecoration(
            color: colors.surfaceContainerHighest.withValues(alpha: .7),
            borderRadius: BorderRadius.circular(10)),
        // − / + only when the column is wide (tablets); phones type directly.
        child: LayoutBuilder(
            builder: (context, c) => c.maxWidth < 112
                ? field
                : Row(children: [
                    button(Icons.remove, 'Restar a', -step),
                    Expanded(child: field),
                    button(Icons.add, 'Sumar a', step),
                  ])));
  }

  /// "50×10", "10 reps" or "—" for the same set last time.
  String _previousLabel(TrainingExercise e, SetResult? s) => s == null
      ? '—'
      : e.bodyweight || s.loadKg == null || s.loadKg == 0
          ? '${s.reps} reps'
          : '${trainingDecimal(s.loadKg!)}×${s.reps}';

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
    final previous = _lastSet(e, index);
    return Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: done
                ? BrandColors.success.withValues(alpha: .16)
                : skipped
                    ? colors.surfaceContainerHighest.withValues(alpha: .6)
                    : null,
            border: c.error != null ? Border.all(color: colors.error) : null),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _tableRow(
              set: Semantics(
                  button: true,
                  label:
                      'Opciones de la serie ${index + 1}, ${prescribed.kindLabel}',
                  child: ExcludeSemantics(
                      child: InkWell(
                          key: ValueKey('set-menu-${prescribed.id}'),
                          customBorder: const CircleBorder(),
                          onTap: _busy ? null : () => _setMenu(e, index),
                          child: Padding(
                              padding: const EdgeInsets.all(4),
                              child: SetBadge(
                                  kind: prescribed.kind,
                                  done: done,
                                  text: skipped ? '—' : e.badgeFor(index)))))),
              previous: Semantics(
                  button: previous != null && editable,
                  label: previous == null
                      ? 'Sin dato anterior'
                      : 'Anterior ${_previousLabel(e, previous)}. Toca para copiar',
                  child: ExcludeSemantics(
                      child: InkWell(
                          borderRadius: BorderRadius.circular(8),
                          onTap: previous == null || !editable
                              ? null
                              : () => _touch(() {
                                    if (!e.bodyweight) {
                                      c.load.text =
                                          trainingDecimal(previous.loadKg ?? 0);
                                    }
                                    c.reps.text = '${previous.reps}';
                                    c.error = null;
                                  }),
                          child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Text(_previousLabel(e, previous),
                                  key: ValueKey('previous-${prescribed.id}'),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: colors.onSurfaceVariant)))))),
              kg: e.bodyweight
                  ? null
                  : _stepper(
                      key: ValueKey('kg-${prescribed.id}'),
                      controller: c.load,
                      hint: kgHint.isEmpty ? 'kg' : kgHint,
                      label: 'kg de la serie ${index + 1}',
                      decimal: true,
                      step: widget.settings.loadStep,
                      enabled: editable,
                      capture: c),
              reps: _stepper(
                  key: ValueKey('reps-${prescribed.id}'),
                  controller: c.reps,
                  hint: repsHint,
                  label: 'reps de la serie ${index + 1}',
                  decimal: false,
                  step: 1,
                  enabled: editable,
                  capture: c),
              check: done
                  ? IconButton.filled(
                      key: ValueKey('check-${prescribed.id}'),
                      tooltip: 'Desmarcar serie ${index + 1}',
                      style: IconButton.styleFrom(
                          backgroundColor: BrandColors.success,
                          foregroundColor: Colors.white),
                      onPressed: _busy ? null : () => _toggle(e, index),
                      icon: const Icon(Icons.check))
                  : IconButton.filledTonal(
                      key: ValueKey('check-${prescribed.id}'),
                      tooltip: 'Marcar serie ${index + 1} como hecha',
                      onPressed:
                          _busy || skipped ? null : () => _toggle(e, index),
                      icon: const Icon(Icons.check))),
          Padding(
              padding: const EdgeInsets.only(left: 40, right: 4),
              child: Row(children: [
                Expanded(
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
                            fontSize: 12,
                            fontWeight: c.error != null
                                ? FontWeight.w700
                                : FontWeight.w400,
                            color: c.error != null
                                ? colors.error
                                : colors.onSurfaceVariant))),
                Semantics(
                    button: true,
                    label:
                        '${rpe ? 'RPE' : 'RIR'} de la serie ${index + 1}: ${effort ?? 'sin dato'}',
                    child: ExcludeSemantics(
                        child: TextButton(
                            key: ValueKey('effort-${prescribed.id}'),
                            style: TextButton.styleFrom(
                                minimumSize: const Size(64, 40),
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 8),
                                foregroundColor: effort == null
                                    ? colors.onSurfaceVariant
                                    : colors.primary),
                            onPressed:
                                editable ? () => _pickEffort(e, c) : null,
                            child: Text(
                                '${rpe ? 'RPE' : 'RIR'} ${effort ?? '—'}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700))))),
              ])),
        ]));
  }

  /// Set number menu: what the professional prescribed and "no la hice".
  Future<void> _setMenu(TrainingExercise e, int index) async {
    final prescribed = e.sets[index];
    final c = _captures[prescribed.id]!;
    final skipped = c.state == 'not_performed';
    final skip = await showModalBottomSheet<bool>(
        context: context,
        showDragHandle: true,
        builder: (sheet) => SafeArea(
            child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Serie ${index + 1} · ${prescribed.kindLabel}',
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text('Objetivo: ${prescribed.target}'),
                      const SizedBox(height: 12),
                      ListTile(
                          key: ValueKey('skip-${prescribed.id}'),
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(skipped
                              ? Icons.undo_rounded
                              : Icons.do_not_disturb_on_outlined),
                          title: Text(skipped ? 'Deshacer' : 'No la hice'),
                          subtitle: Text(skipped
                              ? 'Vuelve a dejarla pendiente.'
                              : 'Se guarda como no hecha, sin reps ni carga.'),
                          onTap: () => Navigator.pop(sheet, true)),
                    ]))));
    if (skip != true || !mounted) return;
    _touch(() {
      c.state = skipped ? null : 'not_performed';
      c.error = null;
    });
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
          child: FilledButton(
              onPressed:
                  _busy || _conflict || _finalized ? null : () => _save(true),
              child: const Text('Finalizar entrenamiento',
                  textAlign: TextAlign.center))),
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

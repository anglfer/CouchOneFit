import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../auth/models/session_models.dart';
import '../models/training.dart';
import '../services/training_service.dart';
import 'training_views.dart';

// Highest efforts first: the usual 6–10 range opens without scrolling.
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
  String? state;
  double? rpe;
  int? rir;
  final TextEditingController reps, load;
  void dispose() {
    reps.dispose();
    load.dispose();
  }
}

class TrainingSessionScreen extends StatefulWidget {
  const TrainingSessionScreen(
      {super.key, required this.contextData, required this.service});
  final TrainingContext contextData;
  final TrainingService service;
  @override
  State<TrainingSessionScreen> createState() => _TrainingSessionScreenState();
}

class _TrainingSessionScreenState extends State<TrainingSessionScreen> {
  final _form = GlobalKey<FormState>();
  final _captures = <String, _Capture>{};
  late TrainingContext _context;
  late String _id;
  late int _revision;
  late bool _finalized;
  bool _dirty = false, _busy = false, _conflict = false;
  String? _error, _notice, _retryPayload, _retryKey;
  @override
  void initState() {
    super.initState();
    _initialize(widget.contextData);
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
    for (final capture in _captures.values) {
      capture.dispose();
    }
    super.dispose();
  }

  void _touch(VoidCallback change) => setState(() {
        change();
        _dirty = true;
      });

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

  Future<void> _save(bool finalize) async {
    if (!_form.currentState!.validate()) {
      setState(() => _error = 'Revisa las series marcadas en rojo.');
      return;
    }
    if (finalize && _captures.values.any((c) => c.state == null)) {
      setState(() => _error =
          'Marca cada serie como hecha o no hecha antes de finalizar.');
      return;
    }
    final results = <Map<String, Object?>>[];
    for (final exercise in _context.day!.exercises) {
      for (final prescribed in exercise.sets) {
        final capture = _captures[prescribed.id]!;
        if (capture.state == null) continue;
        final done = capture.state == 'performed';
        results.add({
          'setId': prescribed.id,
          'state': capture.state,
          'reps': done ? int.parse(capture.reps.text) : 0,
          'loadKg': !done
              ? null
              : exercise.bodyweight
                  ? 0
                  : double.parse(capture.load.text.replaceAll(',', '.')),
          'rpe': done ? capture.rpe : null,
          'rir': done ? capture.rir : null,
        });
      }
    }
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
            ? '¡Entrenamiento finalizado! Puedes corregirlo hasta dos días después.'
            : 'Avance guardado. Puedes continuar después.';
      });
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

  String _resultLabel(SetResult r) => r.state == 'not_performed'
      ? 'No hecha'
      : [
          '${r.reps} reps',
          if (r.loadKg != null && r.loadKg! > 0)
            '${trainingDecimal(r.loadKg!)} kg',
          if (r.rpe != null) 'RPE ${trainingDecimal(r.rpe!)}',
          if (r.rir != null) 'RIR ${r.rir}',
        ].join(' · ');

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
                return 'Serie ${entry.key + 1}: ${matching.isEmpty ? 'pendiente' : _resultLabel(matching.first)}';
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

  @override
  Widget build(BuildContext context) {
    final day = _context.day!;
    final total = _captures.length;
    final marked = _captures.values.where((c) => c.state != null).length;
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
                title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(day.name,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w800)),
                  Text(
                      isToday
                          ? 'Hoy · ${shortDate(_context.localDate)}'
                          : longDate(_context.localDate),
                      style: TextStyle(
                          fontSize: 12, color: colors.onSurfaceVariant)),
                ])),
            body: SafeArea(
                child: Form(
                    key: _form,
                    child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          Center(
                              child: ConstrainedBox(
                                  constraints:
                                      const BoxConstraints(maxWidth: 560),
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        _progress(marked, total),
                                        if (_finalized)
                                          const TrainingNotice(
                                              icon: Icons.check_circle_outline,
                                              text:
                                                  'Entrenamiento finalizado. Si corriges algo, se guarda como corrección.'),
                                        if (_error != null)
                                          TrainingNotice(
                                              text: _error!, error: true),
                                        if (_notice != null)
                                          TrainingNotice(
                                              icon: Icons.check_circle_outline,
                                              text: _notice!),
                                        if (_conflict)
                                          OutlinedButton(
                                              onPressed: _busy
                                                  ? null
                                                  : _reviewConflict,
                                              child: const Text(
                                                  'Ver lo guardado')),
                                        for (final exercise in day.exercises)
                                          _exercise(exercise),
                                        const SizedBox(height: 8),
                                        Text(
                                            'Una serie sin marcar queda pendiente; no cuenta como cero. Necesitas conexión para guardar.',
                                            style: TextStyle(
                                                fontSize: 12,
                                                color:
                                                    colors.onSurfaceVariant)),
                                      ])))
                        ]))),
            bottomNavigationBar: _actions()));
  }

  Widget _progress(int marked, int total) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
              '$marked de ${trainingCount(total, 'serie registrada', 'series registradas')}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                  minHeight: 8,
                  value: total == 0 ? 0 : marked / total,
                  backgroundColor: colors.surfaceContainerHighest)),
        ]));
  }

  Widget _actions() => SafeArea(
      top: false,
      child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              border: Border(
                  top: BorderSide(
                      color: Theme.of(context).colorScheme.outlineVariant))),
          child: Center(
              // heightFactor keeps the bar as tall as its buttons.
              heightFactor: 1,
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: _finalized
                      ? FilledButton(
                          onPressed:
                              _busy || _conflict ? null : () => _save(true),
                          child:
                              Text(_busy ? 'Guardando…' : 'Guardar corrección'))
                      : Row(children: [
                          Expanded(
                              child: OutlinedButton(
                                  onPressed: _busy || _conflict
                                      ? null
                                      : () => _save(false),
                                  child: Text(_busy
                                      ? 'Guardando…'
                                      : 'Guardar avance'))),
                          const SizedBox(width: 10),
                          Expanded(
                              child: FilledButton(
                                  onPressed: _busy || _conflict
                                      ? null
                                      : () => _save(true),
                                  child: const Text('Finalizar entrenamiento',
                                      textAlign: TextAlign.center))),
                        ])))));

  Widget _exercise(TrainingExercise exercise) {
    final colors = Theme.of(context).colorScheme;
    return Card(
        margin: const EdgeInsets.only(top: 12),
        child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                              builder: (_) =>
                                  ExerciseDetailScreen(exercise: exercise))),
                      child: Row(children: [
                        ExerciseAnimation(
                            images: exercise.images,
                            label: exercise.name,
                            size: 64),
                        const SizedBox(width: 12),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(exercise.name,
                                  style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800)),
                              Text(
                                  [
                                    exercise.bodyweight
                                        ? 'Peso corporal'
                                        : 'Con carga',
                                    if (exercise.restLabel != null)
                                      exercise.restLabel!
                                  ].join(' · '),
                                  style: TextStyle(
                                      fontSize: 13,
                                      color: colors.onSurfaceVariant)),
                            ])),
                        Icon(Icons.info_outline,
                            semanticLabel: 'Ver técnica',
                            color: colors.onSurfaceVariant),
                      ])),
                  if (exercise.instructions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(exercise.instructions,
                        style: TextStyle(
                            fontStyle: FontStyle.italic,
                            color: colors.onSurfaceVariant)),
                  ],
                  for (final entry in exercise.sets.asMap().entries)
                    _series(exercise, entry.value, entry.key),
                ])));
  }

  Widget _series(
      TrainingExercise exercise, PrescribedSet prescribed, int index) {
    final capture = _captures[prescribed.id]!;
    final colors = Theme.of(context).colorScheme;
    final done = capture.state == 'performed';
    return Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: done
                ? colors.primaryContainer.withValues(alpha: .35)
                : colors.surfaceContainerHighest.withValues(alpha: .5),
            border: Border.all(
                color: capture.state == null
                    ? colors.outlineVariant
                    : done
                        ? colors.primary.withValues(alpha: .5)
                        : colors.outline)),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            CircleAvatar(
                radius: 14,
                backgroundColor: done ? colors.primary : colors.surface,
                foregroundColor: done ? colors.onPrimary : colors.onSurface,
                child: Text('${index + 1}',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800))),
            const SizedBox(width: 10),
            Expanded(
                child: Text('Objetivo: ${prescribed.target}',
                    style: const TextStyle(fontWeight: FontWeight.w600))),
          ]),
          const SizedBox(height: 10),
          SegmentedButton<String>(
              emptySelectionAllowed: true,
              showSelectedIcon: false,
              style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: colors.primary,
                  selectedForegroundColor: colors.onPrimary),
              segments: const [
                ButtonSegment(
                    value: 'performed',
                    icon: Icon(Icons.check),
                    label: Text('Hecha')),
                ButtonSegment(
                    value: 'not_performed',
                    icon: Icon(Icons.close),
                    label: Text('No la hice')),
              ],
              selected: {if (capture.state != null) capture.state!},
              onSelectionChanged: _busy
                  ? null
                  : (selection) => _touch(() => capture.state =
                      selection.isEmpty ? null : selection.first)),
          if (done) ...[
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (!exercise.bodyweight) ...[
                Expanded(
                    child: TextFormField(
                        controller: capture.load,
                        enabled: !_busy,
                        decoration: InputDecoration(
                            labelText: 'Kg',
                            hintText: prescribed.targetLoadKg == null
                                ? 'Ej. 12,5'
                                : trainingDecimal(prescribed.targetLoadKg!)),
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
                        ],
                        onChanged: (_) => _touch(() {}),
                        validator: (text) {
                          final value = double.tryParse(
                              (text ?? '').replaceAll(',', '.'));
                          return value == null ||
                                  !value.isFinite ||
                                  value <= 0 ||
                                  value > 1000 ||
                                  (value * 10 - (value * 10).round()).abs() >
                                      .00001
                              ? 'De 0,1 a 1000 kg'
                              : null;
                        })),
                const SizedBox(width: 10),
              ],
              Expanded(
                  child: TextFormField(
                      controller: capture.reps,
                      enabled: !_busy,
                      decoration: InputDecoration(
                          labelText: 'Reps hechas',
                          hintText: prescribed.repsMax == null
                              ? '${prescribed.reps}'
                              : '${prescribed.reps}–${prescribed.repsMax}'),
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      onChanged: (_) => _touch(() {}),
                      validator: (text) {
                        final value = int.tryParse(text ?? '');
                        return value == null || value < 1 || value > 1000
                            ? 'De 1 a 1000'
                            : null;
                      })),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                  child: DropdownButtonFormField<double?>(
                      key: ValueKey('rpe-${prescribed.id}'),
                      initialValue: capture.rpe,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'RPE'),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('—')),
                        for (final value in _rpeValues)
                          DropdownMenuItem(
                              value: value,
                              child: Text(trainingDecimal(value))),
                      ],
                      onChanged: _busy
                          ? null
                          : (value) => _touch(() => capture.rpe = value))),
              const SizedBox(width: 10),
              Expanded(
                  child: DropdownButtonFormField<int?>(
                      key: ValueKey('rir-${prescribed.id}'),
                      initialValue: capture.rir,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'RIR'),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('—')),
                        for (var value = 0; value <= 10; value++)
                          DropdownMenuItem(value: value, child: Text('$value')),
                      ],
                      onChanged: _busy
                          ? null
                          : (value) => _touch(() => capture.rir = value))),
            ]),
          ],
          if (capture.state == 'not_performed')
            Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('Registrada como no hecha · sin reps ni carga',
                    style: TextStyle(color: colors.onSurfaceVariant))),
        ]));
  }
}

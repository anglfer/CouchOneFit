import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/sheet_parts.dart';
import '../models/training.dart';
import '../models/training_progress.dart';

/// Quick working-load picker: big number, steps, slider and the advice.
/// Resolves to the chosen kg, or null when dismissed.
Future<double?> showLoadPicker(BuildContext context,
        {required String exerciseName,
        required double initial,
        required double step,
        required int openSets,
        double? recommended,
        double? lastKg,
        String? lastLabel,
        double? oneRm,
        int? targetReps}) =>
    showModalBottomSheet<double>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (_) => _LoadPickerSheet(
            exerciseName: exerciseName,
            initial: initial,
            step: step,
            openSets: openSets,
            recommended: recommended,
            lastKg: lastKg,
            lastLabel: lastLabel,
            oneRm: oneRm,
            targetReps: targetReps));

Future<void> showOneRepMaxCalculator(BuildContext context,
        {double? kg, int? reps}) =>
    showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (_) => _OneRepMaxSheet(kg: kg, reps: reps));

String _signed(double v) => '${v > 0 ? '+' : '−'}${trainingDecimal(v.abs())}';

class _LoadPickerSheet extends StatefulWidget {
  const _LoadPickerSheet(
      {required this.exerciseName,
      required this.initial,
      required this.step,
      required this.openSets,
      this.recommended,
      this.lastKg,
      this.lastLabel,
      this.oneRm,
      this.targetReps});
  final String exerciseName;
  final double initial, step;
  final int openSets;
  final double? recommended, lastKg, oneRm;
  final String? lastLabel;
  final int? targetReps;
  @override
  State<_LoadPickerSheet> createState() => _LoadPickerSheetState();
}

class _LoadPickerSheetState extends State<_LoadPickerSheet> {
  late double _kg = widget.initial;
  late final double _scale = () {
    final top = [
      widget.initial,
      widget.recommended ?? 0,
      widget.lastKg ?? 0,
      widget.oneRm ?? 0
    ].reduce((a, b) => a > b ? a : b);
    final scaled = (top * 1.5 / 10).ceil() * 10.0;
    return scaled < 40 ? 40.0 : scaled;
  }();

  void _set(double kg, {bool haptic = true}) {
    if (haptic) HapticFeedback.selectionClick();
    setState(() =>
        _kg = double.parse(kg.clamp(0, 1000).toDouble().toStringAsFixed(1)));
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final max = _kg > _scale ? (_kg / 10).ceil() * 10.0 : _scale;
    final orm = widget.oneRm;
    final share = orm == null || _kg <= 0 ? null : _kg / orm;
    Widget round(IconData icon, String tooltip, double delta) =>
        IconButton.filledTonal(
            tooltip: tooltip,
            iconSize: 26,
            style: IconButton.styleFrom(fixedSize: const Size(54, 54)),
            onPressed: () => _set(_kg + delta),
            icon: Icon(icon));
    return SafeArea(
        child: SingleChildScrollView(
            child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SheetHeader('Peso de trabajo',
                          subtitle:
                              '${widget.exerciseName} · desliza o toca para ajustar.'),
                      Row(children: [
                        round(
                            Icons.remove_rounded,
                            'Restar ${trainingDecimal(widget.step)} kg',
                            -widget.step),
                        Expanded(
                            child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text.rich(
                                    key: const ValueKey('load-picker-value'),
                                    TextSpan(children: [
                                      TextSpan(
                                          text: trainingDecimal(_kg),
                                          style: const TextStyle(
                                              fontSize: 52,
                                              fontWeight: FontWeight.w900,
                                              letterSpacing: -1,
                                              fontFeatures: [
                                                FontFeature.tabularFigures()
                                              ])),
                                      TextSpan(
                                          text: ' kg',
                                          style: TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.w700,
                                              color: colors.onSurfaceVariant)),
                                    ])))),
                        round(
                            Icons.add_rounded,
                            'Sumar ${trainingDecimal(widget.step)} kg',
                            widget.step),
                      ]),
                      const SizedBox(height: 12),
                      Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final d in const [-1.0, -.5, .5, 1.0])
                              ActionChip(
                                  label: Text(_signed(d)),
                                  onPressed: () => _set(_kg + d)),
                          ]),
                      Slider(
                          value: _kg.clamp(0, max).toDouble(),
                          max: max,
                          divisions: (max * 2).round(),
                          label: '${trainingDecimal(_kg)} kg',
                          semanticFormatterCallback: (v) =>
                              '${trainingDecimal(roundToStep(v, .5))} kg',
                          onChanged: (v) =>
                              _set(roundToStep(v, .5), haptic: false)),
                      if (widget.recommended != null || widget.lastKg != null)
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          if (widget.recommended != null)
                            ActionChip(
                                avatar: const Icon(Icons.trending_up_rounded,
                                    size: 18, color: BrandColors.success),
                                label: Text(
                                    'Recomendado ${trainingDecimal(widget.recommended!)} kg'),
                                onPressed: () => _set(widget.recommended!)),
                          if (widget.lastKg != null)
                            ActionChip(
                                avatar: const Icon(Icons.history, size: 18),
                                label: Text(
                                    'Última vez ${widget.lastLabel ?? '${trainingDecimal(widget.lastKg!)} kg'}'),
                                onPressed: () => _set(widget.lastKg!)),
                        ]),
                      if (share != null) ...[
                        const SizedBox(height: 10),
                        Text(
                            share >= 1
                                ? 'Por encima de tu 1RM estimado (${trainingDecimal(roundToStep(orm!, .5))} kg).'
                                : '≈ ${(share * 100).round()} % de tu 1RM estimado (${trainingDecimal(roundToStep(orm!, .5))} kg) · unas ${repsAtFraction(share)} reps al fallo.',
                            style: TextStyle(
                                fontSize: 12.5,
                                height: 1.35,
                                fontWeight: share >= 1 ? FontWeight.w700 : null,
                                color: share >= 1
                                    ? statusInk(context, colors.error)
                                    : colors.onSurfaceVariant)),
                      ],
                      const SizedBox(height: 16),
                      FilledButton(
                          key: const ValueKey('load-picker-apply'),
                          onPressed: _kg > 0 && widget.openSets > 0
                              ? () => Navigator.pop(context, _kg)
                              : null,
                          child: Text(widget.openSets == 0
                              ? 'No quedan series por marcar'
                              : 'Usar ${trainingDecimal(_kg)} kg en ${trainingCount(widget.openSets, 'serie', 'series')}')),
                      const SizedBox(height: 4),
                      TextButton.icon(
                          onPressed: () => showOneRepMaxCalculator(context,
                              kg: _kg > 0 ? _kg : null,
                              reps: widget.targetReps),
                          icon: const Icon(Icons.calculate_outlined, size: 19),
                          label: const Text('Calculadora 1RM')),
                    ]))));
  }
}

class _OneRepMaxSheet extends StatefulWidget {
  const _OneRepMaxSheet({this.kg, this.reps});
  final double? kg;
  final int? reps;
  @override
  State<_OneRepMaxSheet> createState() => _OneRepMaxSheetState();
}

class _OneRepMaxSheetState extends State<_OneRepMaxSheet> {
  late final _kg = TextEditingController(
      text: widget.kg == null ? '' : trainingDecimal(widget.kg!));
  late final _reps =
      TextEditingController(text: widget.reps == null ? '' : '${widget.reps}');

  @override
  void dispose() {
    _kg.dispose();
    _reps.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final kg = double.tryParse(_kg.text.trim().replaceAll(',', '.'));
    final reps = int.tryParse(_reps.text.trim());
    final valid = kg != null &&
        kg.isFinite &&
        kg > 0 &&
        kg <= 1000 &&
        reps != null &&
        reps >= 1 &&
        reps <= 30;
    final orm = valid ? oneRepMax(kg, reps) : null;
    TextField field(TextEditingController c, String label, Key key,
            {required bool decimal}) =>
        TextField(
            key: key,
            controller: c,
            onChanged: (_) => setState(() {}),
            keyboardType: TextInputType.numberWithOptions(decimal: decimal),
            inputFormatters: [
              FilteringTextInputFormatter.allow(
                  RegExp(decimal ? r'[0-9.,]' : r'[0-9]'))
            ],
            decoration: InputDecoration(labelText: label));
    return Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SafeArea(
            child: SingleChildScrollView(
                child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                    child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SheetHeader('Calculadora 1RM',
                              subtitle:
                                  'Escribe el peso y las reps de una serie reciente hecha con buena técnica.'),
                          Row(children: [
                            Expanded(
                                child: field(
                                    _kg, 'Peso (kg)', const ValueKey('orm-kg'),
                                    decimal: true)),
                            const SizedBox(width: 10),
                            Expanded(
                                child: field(
                                    _reps, 'Reps', const ValueKey('orm-reps'),
                                    decimal: false)),
                          ]),
                          const SizedBox(height: 14),
                          Container(
                              padding: const EdgeInsets.all(16),
                              decoration:
                                  innerPanelDecoration(context, radius: 16),
                              child: orm == null
                                  ? Text(
                                      'Peso de 0,1 a 1000 kg y reps de 1 a 30.',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                          color: colors.onSurfaceVariant))
                                  : Column(children: [
                                      Text('Tu 1RM estimado',
                                          style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: colors.onSurfaceVariant)),
                                      Text(
                                          '${trainingDecimal(roundToStep(orm, .5))} kg',
                                          key: const ValueKey('orm-result'),
                                          style: TextStyle(
                                              fontSize: 40,
                                              fontWeight: FontWeight.w900,
                                              letterSpacing: -1,
                                              color: colors.primary)),
                                      if (reps! > 12)
                                        Text(
                                            'Con más de 12 reps la estimación pierde precisión.',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                                fontSize: 12,
                                                color:
                                                    colors.onSurfaceVariant)),
                                      const SizedBox(height: 10),
                                      for (final p in const [
                                        100,
                                        95,
                                        90,
                                        85,
                                        80,
                                        75,
                                        70,
                                        65,
                                        60
                                      ])
                                        Padding(
                                            padding: const EdgeInsets.symmetric(
                                                vertical: 5),
                                            child: Row(children: [
                                              SizedBox(
                                                  width: 56,
                                                  child: Text('$p %',
                                                      style: TextStyle(
                                                          color: colors
                                                              .onSurfaceVariant))),
                                              Expanded(
                                                  child: Text(
                                                      '${trainingDecimal(roundToStep(orm * p / 100, .5))} kg',
                                                      style: const TextStyle(
                                                          fontWeight:
                                                              FontWeight.w800,
                                                          fontFeatures: [
                                                            FontFeature
                                                                .tabularFigures()
                                                          ]))),
                                              Text(
                                                  p == 100
                                                      ? '1 rep'
                                                      : '≈ ${repsAtFraction(p / 100)} reps',
                                                  style: TextStyle(
                                                      color: colors
                                                          .onSurfaceVariant)),
                                            ])),
                                    ])),
                          const SizedBox(height: 12),
                          Text(
                              'Fórmula de Epley, redondeada a 0,5 kg. Es orientativa: no busques tu máximo sin calentar ni sin supervisión.',
                              style: TextStyle(
                                  fontSize: 12,
                                  height: 1.35,
                                  color: colors.onSurfaceVariant)),
                        ])))));
  }
}

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/detail_scaffold.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../../auth/models/session_models.dart';
import '../../training/models/training.dart';
import '../../training/screens/training_views.dart';
import '../../training/services/training_service.dart';
import '../models/check_in.dart';
import '../services/check_in_service.dart';

String relativeDayLabel(String date, String today) =>
    switch (trainingDate(today).difference(trainingDate(date)).inDays) {
      0 => 'Hoy',
      1 => 'Ayer',
      2 => 'Anteayer',
      _ => capitalized(shortDate(date)),
    };

/// HU-032/037: the only daily capture. Body weight is one more field of the
/// check-in, saved together with the rest in a single request.
class CheckInScreen extends StatefulWidget {
  const CheckInScreen(
      {super.key, required this.service, required this.initial});
  final CheckInService service;
  final CheckInContext initial;
  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  late CheckInContext _ctx = widget.initial;
  final _weight = TextEditingController(), _comment = TextEditingController();
  final _ids = <String, String>{};
  double? _sleep;
  int? _stress, _energy, _hunger;
  String? _nutrition, _error, _weightError, _key, _keyBody;
  bool _loading = false, _saving = false;

  @override
  void initState() {
    super.initState();
    _fill();
  }

  @override
  void dispose() {
    _weight.dispose();
    _comment.dispose();
    super.dispose();
  }

  void _fill() {
    final c = _ctx.checkIn;
    _weight.text =
        c?.bodyWeightKg == null ? '' : trainingDecimal(c!.bodyWeightKg!);
    _comment.text = c?.comment ?? '';
    _sleep = c?.sleepHours;
    _stress = c?.stress;
    _energy = c?.energy;
    _hunger = c?.hunger;
    // A stored not_applicable is implicit: the field only exists with a plan.
    _nutrition = c?.nutritionCompliance == 'not_applicable'
        ? null
        : c?.nutritionCompliance;
    _weightError = null;
  }

  Future<void> _open(String date) async {
    if (date == _ctx.localDate || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final next = await widget.service.context(date: date);
      if (!mounted) return;
      setState(() {
        _ctx = next;
        _fill();
        _key = null;
        _keyBody = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _message(Object error) {
    if (error is! AuthApiException) {
      return 'No pudimos completar la operación. Inténtalo de nuevo.';
    }
    if (TrainingService.disconnected(error)) {
      return 'No se guardó: no hay conexión. Revisa tu internet y vuelve a intentarlo.';
    }
    return error.message;
  }

  double? _parsedWeight() {
    final text = _weight.text.trim().replaceAll(',', '.');
    if (text.isEmpty) return null;
    final value = double.tryParse(text);
    if (value == null ||
        !value.isFinite ||
        value < 30 ||
        value > 300 ||
        ((value * 10).round() - value * 10).abs() > 1e-6) {
      throw const FormatException(
          'Escribe un peso entre 30 y 300 kg, con un decimal como máximo.');
    }
    return value;
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    double? weight;
    try {
      weight = _parsedWeight();
      setState(() => _weightError = null);
    } on FormatException catch (e) {
      setState(() => _weightError = e.message);
      return;
    }
    final comment = _comment.text.trim();
    final body = <String, Object?>{
      'id': _ctx.checkIn?.id ?? (_ids[_ctx.localDate] ??= trainingId()),
      'localDate': _ctx.localDate,
      'revision': _ctx.checkIn?.revision ?? 0,
      'bodyWeightKg': weight,
      'sleepHours': _sleep,
      'stress': _stress,
      'energy': _energy,
      'hunger': _hunger,
      'nutritionCompliance': _ctx.nutritionApplicable ? _nutrition : null,
      'comment': comment.isEmpty ? null : comment,
    };
    if (body.entries.skip(3).every((e) => e.value == null)) {
      setState(() => _error =
          'Registra al menos un dato: peso, sueño, cómo te sentiste o un comentario.');
      return;
    }
    // A retry of the same payload reuses its key, so a lost response never duplicates.
    final encoded = jsonEncode(body);
    if (encoded != _keyBody) {
      _key = trainingId();
      _keyBody = encoded;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final saved = await widget.service.save(body, _key!);
      if (mounted) Navigator.pop(context, saved);
    } catch (error) {
      if (!mounted) return;
      if (error is AuthApiException && error.code == 'CHECK_IN_CONFLICT') {
        setState(() => _error =
            'Este check-in cambió en otro dispositivo. Cargamos la versión más reciente; revisa y guarda de nuevo.');
        try {
          final next = await widget.service.context(date: _ctx.localDate);
          if (mounted) {
            setState(() {
              _ctx = next;
              _fill();
              _key = null;
              _keyBody = null;
            });
          }
        } catch (_) {/* The banner already asks to retry. */}
      } else {
        setState(() => _error = _message(error));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final enabled = _ctx.canWrite && !_saving && !_loading;
    final label = _ctx.trainingLabel;
    final existing = _ctx.checkIn;
    return DetailScaffold(title: const Text('Check-in diario'), children: [
      Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TonePill(existing == null ? 'Pendiente' : 'Registrado',
                tone: existing == null
                    ? BrandColors.warning
                    : BrandColors.success,
                icon: existing == null
                    ? Icons.schedule_rounded
                    : Icons.check_circle_outline_rounded),
            if (existing != null && existing.revision > 1)
              Text('Corregido · rev. ${existing.revision}',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: colors.onSurfaceVariant)),
          ]),
      const SizedBox(height: 8),
      Text(capitalized(longDate(_ctx.localDate)),
          style: Theme.of(context)
              .textTheme
              .titleLarge
              ?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 4),
      Text(
          existing == null
              ? 'Cuéntale a tu profesional cómo vas. Todo es opcional; guarda lo que tengas.'
              : 'Ya registraste este día. Puedes corregirlo hasta dos días después.',
          style: TextStyle(color: colors.onSurfaceVariant)),
      const SizedBox(height: 14),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final (date, recorded) in _ctx.dates)
          Semantics(
              label:
                  '${relativeDayLabel(date, _ctx.today)}, ${recorded ? 'registrado' : 'pendiente'}',
              selected: date == _ctx.localDate,
              button: true,
              excludeSemantics: true,
              onTap: _saving ? null : () => _open(date),
              child: ChoiceChip(
                  label: Text(relativeDayLabel(date, _ctx.today)),
                  avatar: Icon(
                      recorded
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      size: 18),
                  selected: date == _ctx.localDate,
                  onSelected: _saving ? null : (_) => _open(date))),
      ]),
      if (label != null || _ctx.nutritionApplicable) ...[
        const SizedBox(height: 12),
        if (label != null) _InfoRow(icon: Icons.fitness_center, text: label),
        if (_ctx.nutritionApplicable)
          _InfoRow(
              icon: Icons.restaurant_outlined,
              text: _ctx.nutritionPlanName ?? 'Plan alimenticio vigente'),
      ],
      if (!_ctx.canWrite)
        const NoticeBanner(
            icon: Icons.pause_circle_outline_rounded,
            text:
                'Puedes consultar tu check-in, pero el registro está pausado por ahora.'),
      if (_loading) const LinearProgressIndicator(),
      const SizedBox(height: 12),
      _Section(
          title: 'Peso corporal',
          icon: Icons.monitor_weight_outlined,
          children: [
            TextField(
                controller: _weight,
                enabled: enabled,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
                ],
                decoration: InputDecoration(
                    labelText: 'Peso (kg)',
                    hintText: '70,5',
                    suffixText: 'kg',
                    errorText: _weightError,
                    helperText:
                        'Opcional. Pésate en condiciones parecidas, idealmente en ayunas.',
                    helperMaxLines: 2)),
          ]),
      _Section(
          title: 'Descanso y bienestar',
          icon: Icons.bedtime_outlined,
          children: [
            _SleepField(
                value: _sleep,
                enabled: enabled,
                onChanged: (v) => setState(() => _sleep = v)),
            const SizedBox(height: 14),
            _ScaleField(
                label: 'Estrés',
                value: _stress,
                enabled: enabled,
                words: const [
                  'Muy bajo',
                  'Bajo',
                  'Moderado',
                  'Alto',
                  'Muy alto'
                ],
                toneFor: (v) => v <= 2
                    ? BrandColors.success
                    : v == 3
                        ? BrandColors.warning
                        : BrandColors.error,
                onChanged: (v) => setState(() => _stress = v)),
            _ScaleField(
                label: 'Energía',
                value: _energy,
                enabled: enabled,
                words: const ['Muy baja', 'Baja', 'Normal', 'Alta', 'Muy alta'],
                toneFor: (v) => v >= 4
                    ? BrandColors.success
                    : v == 3
                        ? colors.primary
                        : BrandColors.warning,
                onChanged: (v) => setState(() => _energy = v)),
            _ScaleField(
                label: 'Hambre',
                value: _hunger,
                enabled: enabled,
                words: const [
                  'Muy poca',
                  'Poca',
                  'Moderada',
                  'Mucha',
                  'Extrema'
                ],
                toneFor: (v) => v <= 2
                    ? BrandColors.success
                    : v == 3
                        ? colors.primary
                        : BrandColors.warning,
                onChanged: (v) => setState(() => _hunger = v)),
          ]),
      if (_ctx.nutritionApplicable)
        _Section(
            title: '¿Seguiste tu plan alimenticio?',
            icon: Icons.restaurant_menu,
            children: [
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final value in ['completed', 'partial', 'not_completed'])
                  ChoiceChip(
                      label: Text(complianceLabels[value]!),
                      selected: _nutrition == value,
                      onSelected: enabled
                          ? (on) =>
                              setState(() => _nutrition = on ? value : null)
                          : null),
              ]),
            ]),
      _Section(title: 'Comentario', icon: Icons.chat_bubble_outline, children: [
        TextField(
            controller: _comment,
            enabled: enabled,
            maxLength: 500,
            minLines: 2,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
                hintText: 'Algo que tu profesional deba saber (opcional)')),
      ]),
      if (_error != null)
        NoticeBanner(
            text: _error!,
            tone: NoticeTone.error,
            onRetry: _saving || !_ctx.canWrite ? null : _save),
      const SizedBox(height: 8),
      ValueListenableBuilder<TextEditingValue>(
          valueListenable: _weight,
          builder: (context, weightValue, _) => _SummaryStrip(
              weightText: weightValue.text.trim(),
              sleepHours: _sleep,
              scalesFilled: [_stress, _energy, _hunger]
                  .where((item) => item != null)
                  .length,
              nutrition: _ctx.nutritionApplicable ? _nutrition : null)),
      const SizedBox(height: 12),
      GradientActionButton(
          label: existing == null ? 'Guardar check-in' : 'Guardar corrección',
          busy: _saving,
          busyLabel: 'Guardando…',
          icon: Icons.check_rounded,
          onPressed: enabled ? _save : null),
    ]);
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip(
      {required this.weightText,
      required this.sleepHours,
      required this.scalesFilled,
      required this.nutrition});
  final String weightText;
  final double? sleepHours;
  final int scalesFilled;
  final String? nutrition;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final items = <(String, String)>[
      ('Peso', weightText.isEmpty ? '—' : '$weightText kg'),
      ('Sueño', sleepHours == null ? '—' : '${trainingDecimal(sleepHours!)} h'),
      (
        nutrition != null ? 'Plan' : 'Bienestar',
        nutrition != null ? complianceLabels[nutrition]! : '$scalesFilled/3'
      ),
    ];
    return DecoratedBox(
        decoration: innerPanelDecoration(context, radius: 14),
        child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              for (final (index, (title, value)) in items.indexed)
                Expanded(
                    child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: index == 0
                            ? null
                            : BoxDecoration(
                                border: Border(
                                    left: BorderSide(
                                        color: colors.outlineVariant))),
                        child: Column(children: [
                          Text(title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 11.5,
                                  color: colors.onSurfaceVariant)),
                          const SizedBox(height: 2),
                          Text(value,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontFeatures: [
                                    FontFeature.tabularFigures()
                                  ])),
                        ]))),
            ])));
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Icon(icon, size: 18, color: colors.secondary),
          const SizedBox(width: 8),
          Expanded(
              child: Text(text,
                  style: TextStyle(
                      color: colors.onSurfaceVariant,
                      fontWeight: FontWeight.w600))),
        ]));
  }
}

class _Section extends StatelessWidget {
  const _Section(
      {required this.title, required this.icon, required this.children});
  final String title;
  final IconData icon;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CardTitle(icon: icon, title: title),
            const SizedBox(height: 12),
            ...children,
          ])));
}

/// Half-hour stepper with quick picks; empty means "not reported", never 0.
class _SleepField extends StatelessWidget {
  const _SleepField(
      {required this.value, required this.enabled, required this.onChanged});
  final double? value;
  final bool enabled;
  final ValueChanged<double?> onChanged;
  static const _quick = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final v = value;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        const Expanded(
            child: Text('Horas de sueño',
                style: TextStyle(fontWeight: FontWeight.w700))),
        if (v != null && enabled)
          IconButton(
              tooltip: 'Borrar horas de sueño',
              visualDensity: VisualDensity.compact,
              onPressed: () => onChanged(null),
              icon: const Icon(Icons.close_rounded, size: 18)),
      ]),
      const SizedBox(height: 6),
      Wrap(
          spacing: 10,
          runSpacing: 6,
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(v == null ? 'Sin dato' : 'Descanso registrado',
                style: TextStyle(
                    color: v == null ? colors.onSurfaceVariant : colors.primary,
                    fontWeight: FontWeight.w600)),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton.outlined(
                  tooltip: 'Restar media hora de sueño',
                  onPressed: enabled && v != null && v > 0
                      ? () => onChanged(v - 0.5)
                      : null,
                  icon: const Icon(Icons.remove)),
              ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 58),
                  child: Semantics(
                      container: true,
                      label: v == null
                          ? 'Sin dato de sueño'
                          : '${trainingDecimal(v)} horas de sueño',
                      excludeSemantics: true,
                      child: Text(v == null ? '—' : '${trainingDecimal(v)} h',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: colors.primary,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ])))),
              IconButton.outlined(
                  tooltip: 'Sumar media hora de sueño',
                  onPressed: enabled && (v ?? 0) < 24
                      ? () => onChanged(v == null ? 7 : v + 0.5)
                      : null,
                  icon: const Icon(Icons.add)),
            ]),
          ]),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final hours in _quick)
          ChoiceChip(
              label: Text('${trainingDecimal(hours)} h'),
              selected: v == hours,
              onSelected:
                  enabled ? (on) => onChanged(on ? hours : null) : null),
      ]),
    ]);
  }
}

/// 1 (low) to 5 (high); tapping the selected value clears it.
class _ScaleField extends StatelessWidget {
  const _ScaleField(
      {required this.label,
      required this.value,
      required this.enabled,
      required this.words,
      required this.toneFor,
      required this.onChanged});
  final String label;
  final int? value;
  final bool enabled;
  final List<String> words;
  final Color Function(int) toneFor;
  final ValueChanged<int?> onChanged;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final v = value;
    return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Wrap(
              spacing: 8,
              runSpacing: 4,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                if (v == null)
                  Text('Sin dato',
                      style: TextStyle(
                          color: colors.onSurfaceVariant,
                          fontWeight: FontWeight.w600))
                else
                  TonePill('$v · ${words[v - 1]}', tone: toneFor(v)),
              ]),
          const SizedBox(height: 6),
          DecoratedBox(
              decoration: innerPanelDecoration(context, radius: 12),
              child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Row(children: [
                    for (var n = 1; n <= 5; n++)
                      Expanded(
                          child: Padding(
                              padding: EdgeInsets.only(right: n < 5 ? 4 : 0),
                              child: Semantics(
                                  button: true,
                                  selected: v == n,
                                  label: '$label $n de 5, ${words[n - 1]}',
                                  excludeSemantics: true,
                                  onTap: enabled
                                      ? () => onChanged(v == n ? null : n)
                                      : null,
                                  child: TextButton(
                                      style: TextButton.styleFrom(
                                          minimumSize: const Size(0, 42),
                                          padding: EdgeInsets.zero,
                                          shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(8)),
                                          backgroundColor:
                                              v == n ? colors.primary : null,
                                          foregroundColor: v == n
                                              ? colors.onPrimary
                                              : colors.onSurface),
                                      onPressed: enabled
                                          ? () => onChanged(v == n ? null : n)
                                          : null,
                                      child: Text('$n',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w800)))))),
                  ]))),
          Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                        child: Text(words.first,
                            style: TextStyle(
                                fontSize: 11.5,
                                color: colors.onSurfaceVariant))),
                    Flexible(
                        child: Text(words.last,
                            textAlign: TextAlign.end,
                            style: TextStyle(
                                fontSize: 11.5,
                                color: colors.onSurfaceVariant))),
                  ])),
        ]));
  }
}

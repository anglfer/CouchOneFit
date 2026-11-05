import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../models/training.dart';

const _weekdays = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo'
];
const _months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];
const weekdayInitials = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
String weekdayName(String date) => _weekdays[trainingDate(date).weekday - 1];
String shortDate(String date) {
  final d = trainingDate(date);
  return '${d.day} ${_months[d.month - 1].substring(0, 3)}';
}

String capitalized(String v) =>
    v.isEmpty ? v : v[0].toUpperCase() + v.substring(1);

/// "1:27" or "1:02:05".
String clockLabel(Duration d) {
  String two(int n) => n.toString().padLeft(2, '0');
  final h = d.inHours, m = d.inMinutes % 60, s = d.inSeconds % 60;
  return h > 0 ? '$h:${two(m)}:${two(s)}' : '$m:${two(s)}';
}

String longDate(String date) {
  final d = trainingDate(date);
  return '${weekdayName(date)} ${d.day} de ${_months[d.month - 1]}';
}

/// Section caption used across the client screens (matches "Mi expediente").
class TrainingEyebrow extends StatelessWidget {
  const TrainingEyebrow(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(),
      style: TextStyle(
          color: Theme.of(context).colorScheme.secondary,
          fontSize: 11,
          letterSpacing: 1.6,
          fontWeight: FontWeight.w800));
}

class TrainingNotice extends StatelessWidget {
  const TrainingNotice(
      {super.key,
      required this.text,
      this.icon = Icons.info_outline,
      this.error = false});
  final String text;
  final IconData icon;
  final bool error;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final foreground =
        error ? colors.onErrorContainer : colors.onSecondaryContainer;
    return Semantics(
        liveRegion: true,
        child: Container(
            margin: const EdgeInsets.symmetric(vertical: 6),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
                color:
                    error ? colors.errorContainer : colors.secondaryContainer,
                borderRadius: BorderRadius.circular(14)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: foreground, size: 20),
              const SizedBox(width: 12),
              Expanded(
                  child: Text(text,
                      style: TextStyle(color: foreground, height: 1.35)))
            ])));
  }
}

/// Loops the catalog start/peak frames as a GIF-like demonstration. With
/// reduced motion, or a single frame, it shows a still image.
class ExerciseAnimation extends StatefulWidget {
  const ExerciseAnimation(
      {super.key, required this.images, required this.label, this.size});
  final List<String> images;
  final String label;

  /// Thumbnail size; null fills the available width as a square.
  final double? size;
  @override
  State<ExerciseAnimation> createState() => _ExerciseAnimationState();
}

class _ExerciseAnimationState extends State<ExerciseAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 2200));
  late final Animation<double> _second = TweenSequence<double>([
    TweenSequenceItem(tween: ConstantTween<double>(0), weight: 30),
    TweenSequenceItem(
        tween: Tween<double>(begin: 0, end: 1)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 20),
    TweenSequenceItem(tween: ConstantTween<double>(1), weight: 30),
    TweenSequenceItem(
        tween: Tween<double>(begin: 1, end: 0)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 20),
  ]).animate(_controller);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final animate =
        widget.images.length > 1 && !MediaQuery.disableAnimationsOf(context);
    if (animate && !_controller.isAnimating) _controller.repeat();
    if (!animate) _controller.stop();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _frame(String url) => Image.network(url,
      fit: BoxFit.contain,
      excludeFromSemantics: true,
      errorBuilder: (_, error, stack) => Center(
          child: widget.size == null
              ? const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('Ilustración no disponible',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black87)))
              : const Icon(Icons.fitness_center, color: Colors.black45)),
      loadingBuilder: (_, child, progress) => progress == null
          ? child
          : const Center(
              child: SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2))));

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final radius = BorderRadius.circular(widget.size == null ? 18 : 12);
    final content = widget.images.isEmpty
        ? ColoredBox(
            color: colors.surfaceContainerHighest,
            child: Icon(Icons.fitness_center,
                color: colors.onSurfaceVariant,
                size: widget.size == null ? 48 : 24))
        : ColoredBox(
            color: Colors.white,
            child: Stack(fit: StackFit.expand, children: [
              _frame(widget.images.first),
              if (widget.images.length > 1)
                FadeTransition(
                    opacity: _second, child: _frame(widget.images[1])),
            ]));
    final square = AspectRatio(
        aspectRatio: 1, child: ClipRRect(borderRadius: radius, child: content));
    return Semantics(
        image: true,
        label: 'Demostración de ${widget.label}',
        child: widget.size == null
            ? square
            : SizedBox.square(dimension: widget.size, child: square));
  }
}

/// Round set marker: the set number, or the type letter (C, T, B, D, F)
/// tinted by type; green once the set is done.
class SetBadge extends StatelessWidget {
  const SetBadge(
      {super.key,
      required this.text,
      required this.kind,
      this.done = false,
      this.radius = 13});
  final String text, kind;
  final bool done;
  final double radius;

  static Color? accent(String kind, ColorScheme colors) => switch (kind) {
        'warmup' => const Color(0xFF5B8DEF),
        'top' => colors.primary,
        'drop' => BrandColors.warning,
        'failure' => BrandColors.error,
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final tint = accent(kind, colors);
    return Container(
        width: radius * 2,
        height: radius * 2,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done
                ? BrandColors.success
                : tint?.withValues(alpha: .22) ??
                    colors.surfaceContainerHighest,
            border: done || tint == null
                ? null
                : Border.all(color: tint, width: 1.5)),
        child: Text(text,
            style: TextStyle(
                fontSize: radius * .9,
                fontWeight: FontWeight.w800,
                color: done ? Colors.white : colors.onSurface)));
  }
}

/// Small pill used for prescription facts (reps, RPE, rest…).
class TrainingChip extends StatelessWidget {
  const TrainingChip(this.text, {super.key, this.icon});
  final String text;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
            color: colors.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: colors.onSurfaceVariant),
            const SizedBox(width: 6)
          ],
          Flexible(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.onSurfaceVariant))),
        ]));
  }
}

/// Exercise row with thumbnail, name and prescription summary.
class ExerciseTile extends StatelessWidget {
  const ExerciseTile(
      {super.key, required this.exercise, required this.index, this.onTap});
  final TrainingExercise exercise;
  final int index;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Row(children: [
              ExerciseAnimation(
                  images: exercise.images, label: exercise.name, size: 56),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text('${index + 1}. ${exercise.name}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                        [
                          exercise.summary,
                          if (exercise.restLabel != null) exercise.restLabel!
                        ].join(' · '),
                        style: TextStyle(
                            color: colors.onSurfaceVariant, fontSize: 13)),
                  ])),
              if (onTap != null)
                Icon(Icons.chevron_right, color: colors.onSurfaceVariant),
            ])));
  }
}

class ExerciseDetailScreen extends StatelessWidget {
  const ExerciseDetailScreen({super.key, required this.exercise});
  final TrainingExercise exercise;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
        appBar: AppBar(title: const Text('Ejercicio')),
        body: SafeArea(
            child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                children: [
              Center(
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 520),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Center(
                                child: ConstrainedBox(
                                    constraints:
                                        const BoxConstraints(maxWidth: 320),
                                    child: ExerciseAnimation(
                                        images: exercise.images,
                                        label: exercise.name))),
                            const SizedBox(height: 20),
                            Text(exercise.name,
                                style: text.headlineSmall
                                    ?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 10),
                            Wrap(spacing: 8, runSpacing: 8, children: [
                              TrainingChip(
                                  trainingCount(
                                      exercise.sets.length, 'serie', 'series'),
                                  icon: Icons.repeat),
                              TrainingChip(
                                  exercise.bodyweight
                                      ? 'Peso corporal'
                                      : 'Con carga (kg)',
                                  icon: Icons.fitness_center),
                              if (exercise.restLabel != null)
                                TrainingChip(exercise.restLabel!,
                                    icon: Icons.timer_outlined),
                              for (final e in exercise.equipment)
                                TrainingChip(e, icon: Icons.handyman_outlined),
                            ]),
                            if (exercise.muscles.isNotEmpty) ...[
                              const SizedBox(height: 24),
                              const TrainingEyebrow('Músculos principales'),
                              const SizedBox(height: 8),
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                for (final m in exercise.muscles)
                                  TrainingChip(m,
                                      icon: Icons.accessibility_new),
                              ]),
                            ],
                            const SizedBox(height: 24),
                            const TrainingEyebrow('Tu prescripción'),
                            const SizedBox(height: 8),
                            Card(
                                margin: EdgeInsets.zero,
                                child: Column(children: [
                                  for (final entry
                                      in exercise.sets.asMap().entries)
                                    ListTile(
                                        leading: SetBadge(
                                            radius: 15,
                                            kind: entry.value.kind,
                                            text: exercise.badgeFor(entry.key)),
                                        title: Text(entry.value.target)),
                                ])),
                            if (exercise.instructions.isNotEmpty) ...[
                              const SizedBox(height: 24),
                              const TrainingEyebrow(
                                  'Indicaciones de tu profesional'),
                              const SizedBox(height: 8),
                              Text(exercise.instructions,
                                  style: const TextStyle(height: 1.45)),
                            ],
                            if (exercise.guidance.isNotEmpty) ...[
                              const SizedBox(height: 24),
                              const TrainingEyebrow('Técnica paso a paso'),
                              for (final entry
                                  in exercise.guidance.asMap().entries)
                                Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text('${entry.key + 1}.',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700)),
                                          const SizedBox(width: 8),
                                          Expanded(
                                              child: Text(entry.value,
                                                  style: const TextStyle(
                                                      height: 1.45))),
                                        ])),
                              const SizedBox(height: 24),
                              Text('Datos de ejercicios: RepDB · repdb.co',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: colors.onSurfaceVariant)),
                            ],
                          ])))
            ])));
  }
}

class TrainingDayScreen extends StatelessWidget {
  const TrainingDayScreen({super.key, required this.day});
  final TrainingDay day;
  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: Text(day.name)),
      body: SafeArea(
          child: ListView(padding: const EdgeInsets.all(20), children: [
        Center(
            child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (day.kind == 'rest')
                        const TrainingNotice(
                            icon: Icons.spa_outlined,
                            text:
                                'Día de descanso programado. No hay series por registrar.')
                      else ...[
                        TrainingEyebrow(
                            '${trainingCount(day.exercises.length, 'ejercicio', 'ejercicios')} · ${trainingCount(day.setCount, 'serie', 'series')}'),
                        const SizedBox(height: 8),
                        for (final entry in day.exercises.asMap().entries)
                          ExerciseTile(
                              exercise: entry.value,
                              index: entry.key,
                              onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute<void>(
                                      builder: (_) => ExerciseDetailScreen(
                                          exercise: entry.value)))),
                      ],
                    ])))
      ])));
}

/// Large tab title with subtitle and an optional action (theme toggle…).
class ScreenHeader extends StatelessWidget {
  const ScreenHeader(
      {super.key, required this.title, required this.subtitle, this.trailing});
  final String title, subtitle;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Semantics(
                    header: true,
                    child: Text(title,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(fontSize: 30, height: 1.1))),
                const SizedBox(height: 4),
                Text(subtitle,
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: colors.onSurfaceVariant)),
              ])),
          if (trailing != null) trailing!,
        ]));
  }
}

/// Number tile for the progress grid.
class StatTile extends StatelessWidget {
  const StatTile(
      {super.key,
      required this.icon,
      required this.label,
      required this.value,
      this.highlight = false});
  final IconData icon;
  final String label, value;
  final bool highlight;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
        label: '$label: $value',
        child: ExcludeSemantics(
            child: Card(
                margin: EdgeInsets.zero,
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(icon,
                                size: 16, color: colors.onSurfaceVariant),
                            const SizedBox(width: 6),
                            Expanded(
                                child: Text(label,
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: colors.onSurfaceVariant))),
                          ]),
                          const SizedBox(height: 8),
                          Text(value,
                              style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures()
                                  ],
                                  // Darker green keeps AA contrast on white.
                                  color: highlight
                                      ? Theme.of(context).brightness ==
                                              Brightness.dark
                                          ? BrandColors.success
                                          : const Color(0xFF0A7D56)
                                      : colors.onSurface)),
                        ])))));
  }
}

/// Line + soft area chart for a numeric series (oldest first).
class TrendChart extends StatelessWidget {
  const TrendChart(
      {super.key,
      required this.values,
      required this.label,
      this.height = 44,
      this.axis = false});
  final List<double> values;
  final String label;
  final double height;

  /// Shows min/max guides with their values.
  final bool axis;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
        image: true,
        label: label,
        child: SizedBox(
            height: height,
            child: CustomPaint(
                size: Size.infinite,
                painter: _TrendPainter(values, colors.primary, colors.outline,
                    colors.onSurfaceVariant, axis))));
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(this.values, this.line, this.grid, this.text, this.axis);
  final List<double> values;
  final Color line, grid, text;
  final bool axis;
  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final lo = values.reduce((a, b) => a < b ? a : b);
    final hi = values.reduce((a, b) => a > b ? a : b);
    final span = hi - lo == 0 ? 1 : hi - lo;
    final left = axis ? 36.0 : 0.0, top = 6.0, bottom = size.height - 6;
    final width = size.width - left - 6;
    Offset at(int i) => Offset(
        left +
            (values.length == 1 ? width / 2 : width * i / (values.length - 1)),
        bottom - (values[i] - lo) / span * (bottom - top));
    if (axis) {
      final guide = Paint()
        ..color = grid
        ..strokeWidth = 1;
      for (final (y, v) in [(top, hi), (bottom, lo)]) {
        canvas.drawLine(Offset(left, y), Offset(size.width, y), guide);
        (TextPainter(
                text: TextSpan(
                    text: trainingDecimal(v),
                    style: TextStyle(fontSize: 11, color: text)),
                textDirection: TextDirection.ltr)
              ..layout(maxWidth: left - 4))
            .paint(canvas, Offset(0, y - 7));
      }
    }
    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(at(i).dx, at(i).dy);
    }
    final area = Path.from(path)
      ..lineTo(at(values.length - 1).dx, bottom)
      ..lineTo(at(0).dx, bottom)
      ..close();
    canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                line.withValues(alpha: .28),
                line.withValues(alpha: 0)
              ]).createShader(Rect.fromLTRB(0, top, size.width, bottom)));
    canvas.drawPath(
        path,
        Paint()
          ..color = line
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..strokeJoin = StrokeJoin.round);
    canvas.drawCircle(at(values.length - 1), 4, Paint()..color = line);
  }

  @override
  bool shouldRepaint(_TrendPainter old) =>
      old.values != values || old.line != line;
}

/// Single choice: a segmented control when the labels fit in one row,
/// wrapping chips otherwise (narrow screens or large text).
class ChoiceBar<T> extends StatelessWidget {
  const ChoiceBar(
      {super.key,
      required this.options,
      required this.selected,
      required this.onChanged});
  final List<(T, String)> options;
  final T selected;
  final ValueChanged<T>? onChanged;
  @override
  Widget build(BuildContext context) {
    final scale = MediaQuery.textScalerOf(context).scale(14);
    // Segments share the width equally, so the longest label decides.
    final longest =
        options.fold<int>(0, (m, o) => o.$2.length > m ? o.$2.length : m);
    final needed = options.length * (longest * scale * .55 + 36);
    return LayoutBuilder(
        builder: (context, c) => needed <= c.maxWidth
            ? SegmentedButton<T>(
                showSelectedIcon: false,
                segments: [
                  for (final (value, label) in options)
                    ButtonSegment(value: value, label: Text(label))
                ],
                selected: {selected},
                onSelectionChanged:
                    onChanged == null ? null : (v) => onChanged!(v.first))
            : Wrap(spacing: 8, runSpacing: 8, children: [
                for (final (value, label) in options)
                  ChoiceChip(
                      label: Text(label),
                      showCheckmark: false,
                      selected: value == selected,
                      onSelected:
                          onChanged == null ? null : (_) => onChanged!(value)),
              ]));
  }
}

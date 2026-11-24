import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/detail_scaffold.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/status_view.dart';
import '../models/training.dart';
import '../models/training_progress.dart';

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

/// Catalog media is [still thumbnail, animated GIF]. The GIF plays over the
/// still; paused or with reduced motion only the still is shown.
class ExerciseAnimation extends StatelessWidget {
  const ExerciseAnimation(
      {super.key,
      required this.images,
      required this.label,
      this.size,
      this.paused = false});
  final List<String> images;
  final String label;

  /// Thumbnail size; null fills the available width as a square.
  final double? size;
  final bool paused;

  Widget _frame(String url) => Image.network(url,
      fit: BoxFit.contain,
      excludeFromSemantics: true,
      errorBuilder: (_, error, stack) => Center(
          child: size == null
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
    final radius = BorderRadius.circular(size == null ? 18 : 12);
    final animate = !paused && !MediaQuery.disableAnimationsOf(context);
    final content = images.isEmpty
        ? ColoredBox(
            color: colors.surfaceContainerHighest,
            child: Icon(Icons.fitness_center,
                color: colors.onSurfaceVariant, size: size == null ? 48 : 24))
        : ColoredBox(
            color: Colors.white,
            child: Stack(fit: StackFit.expand, children: [
              _frame(images.first),
              if (images.length > 1 && animate) _frame(images[1]),
            ]));
    final square = AspectRatio(
        aspectRatio: 1, child: ClipRRect(borderRadius: radius, child: content));
    return Semantics(
        image: true,
        label: 'Demostración de $label',
        child: size == null
            ? square
            : SizedBox.square(dimension: size, child: square));
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
                color: done ? BrandColors.onSuccess : colors.onSurface)));
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
            color: colors.surfaceContainerHighest,
            border: Border.all(color: colors.outline.withValues(alpha: 0.65)),
            borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: colors.secondary),
            const SizedBox(width: 5)
          ],
          Flexible(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: colors.onSurfaceVariant))),
        ]));
  }
}

/// Exercise row with thumbnail, order, name and prescription summary.
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
        onTap: onTap,
        child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              ExerciseAnimation(
                  images: exercise.images, label: exercise.name, size: 60),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text('${index + 1}. ${exercise.name}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15.5,
                            height: 1.25)),
                    const SizedBox(height: 4),
                    Text(
                        [
                          exercise.summary,
                          if (exercise.restLabel != null) exercise.restLabel!
                        ].join(' · '),
                        style: TextStyle(
                            color: colors.onSurfaceVariant,
                            fontSize: 13,
                            height: 1.35)),
                  ])),
              if (onTap != null) ...[
                const SizedBox(width: 6),
                Icon(Icons.chevron_right_rounded,
                    color: colors.onSurfaceVariant),
              ],
            ])));
  }
}

/// Titled block of the exercise detail.
class _DetailSection extends StatelessWidget {
  const _DetailSection(this.title, this.children);
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SectionTitle(title),
        const SizedBox(height: 12),
        ...children,
      ]));
}

class ExerciseDetailScreen extends StatefulWidget {
  const ExerciseDetailScreen({super.key, required this.exercise});
  final TrainingExercise exercise;
  @override
  State<ExerciseDetailScreen> createState() => _ExerciseDetailScreenState();
}

class _ExerciseDetailScreenState extends State<ExerciseDetailScreen> {
  bool _paused = false;

  @override
  Widget build(BuildContext context) {
    final exercise = widget.exercise;
    final text = Theme.of(context).textTheme;
    final colors = Theme.of(context).colorScheme;
    final canPause =
        exercise.images.length > 1 && !MediaQuery.disableAnimationsOf(context);
    return DetailScaffold(
        title: const Text('Ejercicio'),
        maxWidth: 520,
        children: [
          // White stage: the catalog art is drawn on white.
          Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: exercise.images.isEmpty
                      ? colors.surfaceContainerHighest
                      : Colors.white,
                  border: Border.all(color: colors.outlineVariant),
                  borderRadius: BorderRadius.circular(24)),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Center(
                    child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 280),
                        child: ExerciseAnimation(
                            images: exercise.images,
                            label: exercise.name,
                            paused: _paused))),
                if (canPause) ...[
                  const SizedBox(height: 8),
                  TextButton.icon(
                      style:
                          TextButton.styleFrom(foregroundColor: Colors.black87),
                      onPressed: () => setState(() => _paused = !_paused),
                      icon: Icon(
                          _paused
                              ? Icons.play_arrow_rounded
                              : Icons.pause_rounded,
                          size: 18),
                      label: Text(_paused ? 'Reanudar' : 'Pausar')),
                ],
              ])),
          if (exercise.images.isEmpty) ...[
            const SizedBox(height: 8),
            Text('Ejercicio personalizado · sin animación de catálogo',
                textAlign: TextAlign.center,
                style:
                    TextStyle(fontSize: 12.5, color: colors.onSurfaceVariant)),
          ],
          const SizedBox(height: 20),
          Semantics(
              header: true,
              child: Text(exercise.name, style: text.headlineSmall)),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            TrainingChip(trainingCount(exercise.sets.length, 'serie', 'series'),
                icon: Icons.repeat),
            TrainingChip(
                exercise.bodyweight ? 'Peso corporal' : 'Con carga (kg)',
                icon: Icons.fitness_center),
            if (exercise.restLabel != null)
              TrainingChip(exercise.restLabel!, icon: Icons.timer_outlined),
            for (final e in exercise.equipment)
              TrainingChip(e, icon: Icons.handyman_outlined),
          ]),
          if (exercise.muscles.isNotEmpty)
            _DetailSection('Músculos principales', [
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final m in exercise.muscles)
                  TrainingChip(m, icon: Icons.accessibility_new),
              ]),
            ]),
          _DetailSection('Tu prescripción', [
            GroupCard(indent: 56, children: [
              for (final entry in exercise.sets.asMap().entries)
                Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    child: Row(children: [
                      SetBadge(
                          radius: 15,
                          kind: entry.value.kind,
                          text: exercise.badgeFor(entry.key)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Text(
                              entry.value
                                  .targetFor(bodyweight: exercise.bodyweight),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600))),
                    ])),
            ]),
          ]),
          if (exercise.instructions.isNotEmpty)
            _DetailSection('Indicaciones de tu profesional', [
              Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                      color: colors.primaryContainer.withValues(alpha: .55),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: colors.primary.withValues(alpha: .25))),
                  child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.campaign_outlined,
                            size: 18, color: colors.secondary),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Text(exercise.instructions,
                                style: TextStyle(
                                    height: 1.45,
                                    color: colors.onPrimaryContainer))),
                      ])),
            ]),
          if (exercise.guidance.isNotEmpty) ...[
            _DetailSection('Técnica paso a paso', [
              Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final entry
                                in exercise.guidance.asMap().entries)
                              Padding(
                                  padding: EdgeInsets.only(
                                      top: entry.key == 0 ? 0 : 12),
                                  child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        _StepNumber(entry.key + 1),
                                        const SizedBox(width: 12),
                                        Expanded(
                                            child: Padding(
                                                padding: const EdgeInsets.only(
                                                    top: 3),
                                                child: Text(entry.value,
                                                    style: const TextStyle(
                                                        height: 1.45)))),
                                      ])),
                          ]))),
            ]),
            const SizedBox(height: 16),
            Text('Animaciones de ejercicios: © Gym visual · gymvisual.com',
                style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
          ],
        ]);
  }
}

class _StepNumber extends StatelessWidget {
  const _StepNumber(this.number);
  final int number;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            shape: BoxShape.circle, color: colors.primaryContainer),
        child: Text('$number',
            style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: colors.onPrimaryContainer)));
  }
}

class TrainingDayScreen extends StatelessWidget {
  const TrainingDayScreen(
      {super.key,
      required this.day,
      this.onStart,
      this.startLabel = 'Empezar entrenamiento'});
  final TrainingDay day;
  final VoidCallback? onStart;
  final String startLabel;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    if (day.kind == 'rest') {
      return DetailScaffold(title: Text(day.name), children: const [
        Padding(
            padding: EdgeInsets.only(top: 32),
            child: StatusView(
                icon: Icons.bedtime_outlined,
                title: 'Día de descanso',
                message:
                    'Día de descanso programado. No hay series por registrar: recuperar también es parte del plan.'))
      ]);
    }
    final groups = dayGroups(day);
    return DetailScaffold(title: Text(day.name), maxWidth: 520, children: [
      Card(
          margin: EdgeInsets.zero,
          child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                        '${trainingCount(day.exercises.length, 'ejercicio', 'ejercicios')} · ${trainingCount(day.setCount, 'serie', 'series')}',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: colors.onSurface)),
                    if (groups.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        for (final g in groups)
                          TrainingChip(g, icon: Icons.accessibility_new),
                      ]),
                    ],
                    if (onStart != null) ...[
                      const SizedBox(height: 16),
                      GradientActionButton(
                          label: startLabel,
                          icon: Icons.play_arrow_rounded,
                          onPressed: onStart),
                    ],
                  ]))),
      const SizedBox(height: 18),
      const SectionTitle('Ejercicios'),
      const SizedBox(height: 10),
      GroupCard(indent: 88, children: [
        for (final entry in day.exercises.asMap().entries)
          ExerciseTile(
              exercise: entry.value,
              index: entry.key,
              onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                      builder: (_) =>
                          ExerciseDetailScreen(exercise: entry.value)))),
      ]),
    ]);
  }
}

/// Large tab title with its context underneath and an optional action.
class ScreenHeader extends StatelessWidget {
  const ScreenHeader(
      {super.key, required this.title, required this.subtitle, this.trailing});
  final String title, subtitle;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
        padding: const EdgeInsets.fromLTRB(2, 4, 0, 18),
        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
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
                        fontSize: 14,
                        height: 1.3,
                        color: colors.onSurfaceVariant)),
              ])),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ]));
  }
}

/// One metric cell: label on top, the number as the loudest element.
class StatTile extends StatelessWidget {
  const StatTile(
      {super.key,
      required this.icon,
      required this.label,
      required this.value,
      this.highlight = false,
      this.large = false,
      this.progress});
  final IconData icon;
  final String label, value;
  final bool highlight, large;
  final double? progress;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final tone = highlight
        ? statusInk(context, BrandColors.success)
        : colors.onSurfaceVariant;
    return Semantics(
        label: '$label: $value',
        child: ExcludeSemantics(
            child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Icon(icon, size: 16, color: tone),
                        const SizedBox(width: 6),
                        // Narrow tiles shrink one-word labels and values
                        // instead of breaking them mid-word.
                        Expanded(
                            child: FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Text(label,
                                    style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: colors.onSurfaceVariant)))),
                      ]),
                      const SizedBox(height: 6),
                      FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(value,
                              style: TextStyle(
                                  fontSize: large ? 34 : 24,
                                  height: 1.1,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: large ? -0.8 : -0.4,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures()
                                  ],
                                  color: highlight ? tone : colors.onSurface))),
                      if (progress != null) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                                minHeight: 4,
                                value: progress!.clamp(0.0, 1.0),
                                color: highlight ? tone : colors.primary,
                                backgroundColor:
                                    colors.surfaceContainerHighest)),
                      ],
                    ]))));
  }
}

/// Metrics that belong together in one card, two per row; they stack when
/// narrow or with large text.
class StatPanel extends StatelessWidget {
  const StatPanel({super.key, required this.tiles, this.lead});
  final List<StatTile> tiles;

  /// Optional full-width metric above the grid.
  final StatTile? lead;
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final stacked = constraints.maxWidth < 280 ||
          MediaQuery.textScalerOf(context).scale(14) > 22;
      return GroupCard(children: [
        if (lead != null) lead!,
        if (stacked)
          ...tiles
        else
          for (var i = 0; i < tiles.length; i += 2)
            IntrinsicHeight(
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                  Expanded(child: tiles[i]),
                  const VerticalDivider(width: 1),
                  Expanded(
                      child: i + 1 < tiles.length
                          ? tiles[i + 1]
                          : const SizedBox.shrink()),
                ])),
      ]);
    });
  }
}

/// Line + soft area chart for a numeric series (oldest first).
class TrendChart extends StatelessWidget {
  const TrendChart(
      {super.key,
      required this.values,
      this.label = 'Tendencia',
      this.height = 54,
      this.axis = false,
      this.firstLabel,
      this.lastLabel});
  final List<double> values;
  final String label;
  final double height;

  /// Shows min/max guides with their values.
  final bool axis;
  final String? firstLabel, lastLabel;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final chart = SizedBox(
        height: height,
        child: CustomPaint(
            size: Size.infinite,
            painter: _TrendPainter(values, colors.primary, colors.outline,
                colors.onSurfaceVariant, colors.surface, axis)));
    return Semantics(
        image: true,
        label: label,
        child: firstLabel == null && lastLabel == null
            ? chart
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                chart,
                const SizedBox(height: 4),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                          child: Text(firstLabel ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 11,
                                  color: colors.onSurfaceVariant))),
                      Flexible(
                          child: Text(lastLabel ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 11,
                                  color: colors.onSurfaceVariant))),
                    ]),
              ]));
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(
      this.values, this.line, this.grid, this.text, this.surface, this.axis);
  final List<double> values;
  final Color line, grid, text, surface;
  final bool axis;
  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final lo = values.reduce((a, b) => a < b ? a : b);
    final hi = values.reduce((a, b) => a > b ? a : b);
    final span = hi - lo == 0 ? 1 : hi - lo;
    final left = axis ? 40.0 : 4.0, top = 8.0, bottom = size.height - 8;
    final width = (size.width - left - 8).clamp(1.0, double.infinity);
    Offset at(int i) => Offset(
        left +
            (values.length == 1 ? width / 2 : width * i / (values.length - 1)),
        bottom - (values[i] - lo) / span * (bottom - top));
    if (axis) {
      final guide = Paint()
        ..color = grid.withValues(alpha: 0.45)
        ..strokeWidth = 1;
      final guides = hi == lo
          ? [(top, hi), (bottom, lo)]
          : [(top, hi), ((top + bottom) / 2, (hi + lo) / 2), (bottom, lo)];
      for (final (y, v) in guides) {
        canvas.drawLine(Offset(left, y), Offset(size.width, y), guide);
        (TextPainter(
                text: TextSpan(
                    text: trainingDecimal(v),
                    style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        fontFeatures: const [FontFeature.tabularFigures()],
                        color: text)),
                textDirection: TextDirection.ltr)
              ..layout(maxWidth: left - 6))
            .paint(canvas, Offset(0, y - 7));
      }
    }
    final pts = [for (var i = 0; i < values.length; i++) at(i)];
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    if (pts.length == 2) {
      path.lineTo(pts[1].dx, pts[1].dy);
    } else if (pts.length > 2) {
      // Fritsch-Carlson monotone tangents keep smooth curves inside [lo, hi].
      final n = pts.length;
      final d = <double>[
        for (var k = 0; k < n - 1; k++)
          (pts[k + 1].dy - pts[k].dy) /
              ((pts[k + 1].dx - pts[k].dx).abs() < 1e-6
                  ? 1.0
                  : pts[k + 1].dx - pts[k].dx),
      ];
      final m = List<double>.filled(n, 0);
      m[0] = d[0];
      m[n - 1] = d[n - 2];
      for (var i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] > 0) {
          m[i] = 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]);
        }
      }
      for (var i = 0; i < n - 1; i++) {
        final dx = (pts[i + 1].dx - pts[i].dx) / 3;
        path.cubicTo(
          pts[i].dx + dx,
          pts[i].dy + m[i] * dx,
          pts[i + 1].dx - dx,
          pts[i + 1].dy - m[i + 1] * dx,
          pts[i + 1].dx,
          pts[i + 1].dy,
        );
      }
    }
    final area = Path.from(path)
      ..lineTo(pts.last.dx, bottom)
      ..lineTo(pts.first.dx, bottom)
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
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round);
    if (pts.length <= 12) {
      final dotFill = Paint()..color = surface;
      final dotStroke = Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      for (var i = 0; i < pts.length - 1; i++) {
        canvas.drawCircle(pts[i], 3.0, dotFill);
        canvas.drawCircle(pts[i], 3.0, dotStroke);
      }
    }
    final end = pts.last;
    canvas.drawCircle(end, 6.5, Paint()..color = line.withValues(alpha: 0.25));
    canvas.drawCircle(end, 4, Paint()..color = line);
    canvas.drawCircle(end, 1.6, Paint()..color = surface);
  }

  @override
  bool shouldRepaint(_TrendPainter old) =>
      old.axis != axis ||
      old.line != line ||
      old.grid != grid ||
      old.text != text ||
      old.surface != surface ||
      !listEquals(old.values, values);
}

/// Single choice: a pill track when the labels fit in one row, swipeable
/// chips otherwise (narrow screens or large text).
class ChoiceBar<T> extends StatelessWidget {
  const ChoiceBar(
      {super.key,
      required this.options,
      required this.selected,
      required this.onChanged,
      this.icons,
      this.subtle = false});
  final List<(T, String)> options;
  final T selected;
  final ValueChanged<T>? onChanged;

  /// Optional icon per option, track layout only.
  final List<IconData>? icons;

  /// Neutral elevated surface pill for secondary switches inside cards.
  final bool subtle;

  Widget _segment(BuildContext context, int index) {
    final colors = Theme.of(context).colorScheme;
    final light = Theme.of(context).brightness == Brightness.light;
    final (value, label) = options[index];
    final on = value == selected;
    final enabled = onChanged != null;
    final tone = !enabled
        ? Theme.of(context).hintColor
        : on
            ? (subtle ? colors.onSurface : Colors.white)
            : colors.onSurfaceVariant;
    return Semantics(
        button: true,
        selected: on,
        enabled: enabled,
        label: label,
        excludeSemantics: true,
        // Excluding the child also drops its tap: expose it here.
        onTap: enabled ? () => onChanged!(value) : null,
        child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: enabled ? () => onChanged!(value) : null,
            child: Padding(
                padding: const EdgeInsets.all(3),
                child: AnimatedContainer(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 180),
                    curve: Curves.easeOutCubic,
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: on
                            ? subtle
                                ? colors.surface
                                : enabled
                                    ? actionFill(context)
                                    : colors.surface
                            : null,
                        borderRadius: BorderRadius.circular(11),
                        border: on && (subtle || !enabled)
                            ? Border.all(
                                color: colors.outline
                                    .withValues(alpha: enabled ? 0.85 : 0.6))
                            : null,
                        boxShadow: on && subtle && enabled && light
                            ? [
                                BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.06),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2))
                              ]
                            : null),
                    child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          if (icons != null) ...[
                            Icon(icons![index], size: 17, color: tone),
                            const SizedBox(width: 6),
                          ],
                          Text(label,
                              maxLines: 1,
                              style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight:
                                      on ? FontWeight.w800 : FontWeight.w600,
                                  color: tone)),
                        ]))))));
  }

  @override
  Widget build(BuildContext context) {
    final scale = MediaQuery.textScalerOf(context).scale(13.5);
    final characters = options.fold<int>(0, (t, o) => t + o.$2.length);
    final needed =
        characters * scale * .56 + options.length * (icons == null ? 22 : 44);
    return LayoutBuilder(
        builder: (context, c) => needed <= c.maxWidth
            ? DecoratedBox(
                decoration: innerPanelDecoration(context, radius: 14),
                child: Material(
                    type: MaterialType.transparency,
                    child: Row(children: [
                      // Wider labels get more room: equal shares would force
                      // the swipeable chips much sooner.
                      for (var i = 0; i < options.length; i++)
                        Expanded(
                            flex: options[i].$2.length + 4,
                            child: _segment(context, i)),
                    ])))
            // One swipeable line: a wrapped row would orphan the last tab.
            : SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                clipBehavior: Clip.none,
                child: Row(children: [
                  for (final (value, label) in options)
                    Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                            label: Text(label),
                            showCheckmark: false,
                            selected: value == selected,
                            onSelected: onChanged == null
                                ? null
                                : (_) => onChanged!(value))),
                ])));
  }
}

/// Heading of a summary card: badge, title and an optional link that drops
/// below the title when the row would squeeze it (narrow or large text).
class CardTitle extends StatelessWidget {
  const CardTitle(
      {super.key,
      required this.icon,
      required this.title,
      this.action,
      this.onAction});
  final IconData icon;
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    final heading = Row(children: [
      Icon(icon, size: 18, color: Theme.of(context).colorScheme.secondary),
      const SizedBox(width: 8),
      Expanded(
          child: Semantics(
              header: true,
              child: Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontSize: 15, fontWeight: FontWeight.w800)))),
    ]);
    if (action == null) return heading;
    final link = TextButton(
        onPressed: onAction,
        style: TextButton.styleFrom(
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: 8)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Flexible(child: Text(action!, overflow: TextOverflow.ellipsis)),
          const Icon(Icons.chevron_right_rounded, size: 18),
        ]));
    return LayoutBuilder(
        builder: (context, c) => c.maxWidth >= 300 &&
                MediaQuery.textScalerOf(context).scale(14) <= 19.5
            ? Row(children: [Expanded(child: heading), link])
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                heading,
                Align(alignment: Alignment.centerLeft, child: link),
              ]));
  }
}

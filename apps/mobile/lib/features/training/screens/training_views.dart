import 'package:flutter/material.dart';
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
                            ]),
                            const SizedBox(height: 24),
                            const TrainingEyebrow('Tu prescripción'),
                            const SizedBox(height: 8),
                            Card(
                                margin: EdgeInsets.zero,
                                child: Column(children: [
                                  for (final entry
                                      in exercise.sets.asMap().entries)
                                    ListTile(
                                        leading: CircleAvatar(
                                            radius: 15,
                                            child: Text('${entry.key + 1}',
                                                style: const TextStyle(
                                                    fontSize: 13))),
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

import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../models/training_progress.dart';

/// Same thresholds as the recovery rows: loaded, recovering, recovered.
Color recoveryColor(double ratio) => ratio >= 1
    ? BrandColors.success
    : ratio >= .5
        ? BrandColors.warning
        : BrandColors.highlight;

/// Front and back body figures with each display group (see
/// `muscleGroups`) painted with [fill]; groups missing from it stay neutral.
class MuscleMap extends StatelessWidget {
  const MuscleMap(
      {super.key,
      required this.fill,
      required this.semanticsLabel,
      this.height = 220});
  final Map<String, Color> fill;
  final String semanticsLabel;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    Widget figure(bool front) =>
        Column(mainAxisSize: MainAxisSize.min, children: [
          CustomPaint(
              size: Size(height / 2, height),
              painter: _BodyPainter(
                  front: front,
                  fill: fill,
                  base: Color.lerp(
                      colors.surfaceContainerHighest, colors.onSurface, .05)!,
                  idle: Color.lerp(
                      colors.surfaceContainerHighest, colors.onSurface, .17)!,
                  outline:
                      Theme.of(context).cardTheme.color ?? colors.surface)),
          const SizedBox(height: 4),
          Text(front ? 'Frente' : 'Espalda',
              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
        ]);
    return Semantics(
        image: true,
        label: semanticsLabel,
        child: ExcludeSemantics(
            child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  figure(true),
                  SizedBox(width: height * .12),
                  figure(false),
                ]))));
  }
}

/// Recovery figure plus the overall estimate, shared by Inicio and Progreso.
class RecoveryBody extends StatelessWidget {
  const RecoveryBody({super.key, required this.items, this.height = 220});
  final List<GroupRecovery> items;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final overall = items.isEmpty
        ? null
        : (items.fold<double>(0, (t, r) => t + r.ratio) / items.length * 100)
            .round();
    Widget legend(Color color, String text) =>
        Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Flexible(
              child: Text(text,
                  style:
                      TextStyle(fontSize: 12, color: colors.onSurfaceVariant))),
        ]);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      MuscleMap(
          height: height,
          fill: {for (final r in items) r.group: recoveryColor(r.ratio)},
          semanticsLabel: overall == null
              ? 'Figura muscular sin datos de recuperación'
              : 'Figura muscular. Recuperación general $overall %. ${items.map((r) => '${r.group} ${(r.ratio * 100).round()} %').join(', ')}'),
      if (overall != null) ...[
        const SizedBox(height: 10),
        Center(
            child: Text.rich(
                TextSpan(children: [
                  TextSpan(
                      text: '$overall %',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: colors.onSurface)),
                  const TextSpan(text: '  recuperación general'),
                ]),
                textAlign: TextAlign.center,
                style: TextStyle(color: colors.onSurfaceVariant))),
      ],
      const SizedBox(height: 8),
      Wrap(
          alignment: WrapAlignment.center,
          spacing: 14,
          runSpacing: 6,
          children: [
            legend(BrandColors.highlight, 'Cargado'),
            legend(BrandColors.warning, 'Recuperándose'),
            legend(BrandColors.success, 'Recuperado'),
          ]),
    ]);
  }
}

// Figures are drawn in a 100 × 200 box; x mirrors around 50.
Path _oval(double cx, double cy, double rx, double ry) => Path()
  ..addOval(
      Rect.fromCenter(center: Offset(cx, cy), width: rx * 2, height: ry * 2));
Path _round(double l, double t, double r, double b, double radius) =>
    Path()..addRRect(RRect.fromLTRBR(l, t, r, b, Radius.circular(radius)));
Path _poly(List<Offset> points) => Path()..addPolygon(points, true);

/// Pectoral: square at the sternum, rounded towards the armpit and below.
Path _pec(double s) {
  const inner = Radius.circular(3), outer = Radius.circular(11);
  return Path()
    ..addRRect(s < 0
        ? RRect.fromLTRBAndCorners(35.5, 32, 49.2, 51,
            topLeft: outer,
            bottomLeft: outer,
            topRight: inner,
            bottomRight: outer)
        : RRect.fromLTRBAndCorners(50.8, 32, 64.5, 51,
            topLeft: inner,
            bottomLeft: outer,
            topRight: outer,
            bottomRight: outer));
}

/// [build] receives the side sign (−1 left, 1 right) and returns one shape.
List<Path> _both(Path Function(double s) build) => [build(-1), build(1)];

List<Path> _silhouette() => [
      _oval(50, 12, 8.5, 10.5),
      _round(45, 20, 55, 30, 3),
      _poly(const [
        Offset(32, 30),
        Offset(68, 30),
        Offset(66, 62),
        Offset(63, 92),
        Offset(37, 92),
        Offset(34, 62),
      ]),
      ..._both((s) => _oval(50 + s * 24, 52, 6.5, 14)),
      ..._both((s) => _oval(50 + s * 27, 79, 5, 13)),
      ..._both((s) => _oval(50 + s * 28.5, 97, 4, 5)),
      _round(37, 86, 63, 106, 9),
      ..._both((s) => _oval(50 + s * 7.5, 126, 8.5, 24)),
      ..._both((s) => _oval(50 + s * 7.5, 150, 6, 5)),
      ..._both((s) => _oval(50 + s * 7.5, 168, 6, 17)),
      ..._both((s) => _oval(50 + s * 8.5, 189, 5, 4)),
    ];

List<(String, Path)> _front() => [
      for (final p in _both((s) => _oval(50 + s * 19, 37, 7.5, 7)))
        ('Hombros', p),
      for (final p in _both((s) => _pec(s))) ('Pecho', p),
      for (final p in _both((s) => _oval(50 + s * 24, 54, 5, 10.5)))
        ('Bíceps', p),
      for (final p in _both((s) => _oval(50 + s * 27, 79, 4.2, 11)))
        ('Antebrazos', p),
      ('Abdomen', _round(42.5, 54, 57.5, 88, 5)),
      for (final p in _both((s) => _oval(50 + s * 11, 72, 3, 12)))
        ('Abdomen', p),
      for (final p in _both((s) => _oval(50 + s * 8.5, 126, 7, 21)))
        ('Cuádriceps', p),
      for (final p in _both((s) => _oval(50 + s * 3.2, 108, 2.6, 10)))
        ('Aductores', p),
      for (final p in _both((s) => _oval(50 + s * 8, 168, 4.5, 14)))
        ('Pantorrillas', p),
    ];

List<(String, Path)> _back() => [
      (
        'Espalda',
        _poly(const [
          Offset(50, 21),
          Offset(61, 31),
          Offset(57, 40),
          Offset(50, 47),
          Offset(43, 40),
          Offset(39, 31),
        ])
      ),
      for (final p in _both((s) => _poly([
            Offset(50 + s * 2, 47),
            Offset(50 + s * 14, 37),
            Offset(50 + s * 15.5, 56),
            Offset(50 + s * 10, 74),
            Offset(50 + s * 2, 70),
          ])))
        ('Espalda', p),
      ('Espalda', _round(45, 71, 55, 88, 4)),
      for (final p in _both((s) => _oval(50 + s * 19, 37, 7.5, 7)))
        ('Hombros', p),
      for (final p in _both((s) => _oval(50 + s * 24, 54, 5, 10.5)))
        ('Tríceps', p),
      for (final p in _both((s) => _oval(50 + s * 27, 79, 4.2, 11)))
        ('Antebrazos', p),
      for (final p in _both((s) => _oval(50 + s * 6.5, 98, 7.5, 8)))
        ('Glúteos', p),
      for (final p in _both((s) => _oval(50 + s * 8, 128, 7, 19)))
        ('Isquiotibiales', p),
      for (final p in _both((s) => _oval(50 + s * 8, 165, 5.5, 13)))
        ('Pantorrillas', p),
    ];

class _BodyPainter extends CustomPainter {
  _BodyPainter(
      {required this.front,
      required this.fill,
      required this.base,
      required this.idle,
      required this.outline});
  final bool front;
  final Map<String, Color> fill;
  final Color base, idle, outline;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 100, size.height / 200);
    final paint = Paint()..isAntiAlias = true;
    paint.color = base;
    for (final p in _silhouette()) {
      canvas.drawPath(p, paint);
    }
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..color = outline;
    for (final (group, path) in front ? _front() : _back()) {
      paint.color = fill[group] ?? idle;
      canvas.drawPath(path, paint);
      canvas.drawPath(path, stroke);
    }
  }

  @override
  bool shouldRepaint(_BodyPainter old) =>
      old.front != front ||
      old.base != base ||
      old.idle != idle ||
      old.outline != outline ||
      old.fill.length != fill.length ||
      old.fill.entries.any((e) => fill[e.key] != e.value);
}

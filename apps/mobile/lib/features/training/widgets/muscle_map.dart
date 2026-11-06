import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../models/training_progress.dart';

/// Same thresholds as the recovery rows: loaded, recovering, recovered.
Color recoveryColor(double ratio) => ratio >= 1
    ? BrandColors.success
    : ratio >= .5
        ? BrandColors.warning
        : BrandColors.highlight;

/// Front and back anatomical figures with each display group (see
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
    final dark = Theme.of(context).brightness == Brightness.dark;
    final panel = Color.lerp(
        colors.surface, colors.surfaceContainerHighest, dark ? .55 : .7)!;
    Widget figure(bool front, double height) =>
        Column(mainAxisSize: MainAxisSize.min, children: [
          CustomPaint(
              size: Size(height * _box.width / _box.height, height),
              painter: _BodyPainter(
                  front: front,
                  fill: fill,
                  skin: Color.lerp(panel, colors.onSurface, dark ? .09 : .1)!,
                  idle: Color.lerp(panel, colors.onSurface, dark ? .2 : .2)!,
                  gap: panel)),
          const SizedBox(height: 8),
          Text(front ? 'Frente' : 'Espalda',
              style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: .4,
                  color: colors.onSurfaceVariant)),
        ]);
    return Semantics(
        image: true,
        label: semanticsLabel,
        child: ExcludeSemantics(
            child: Container(
                padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
                decoration: BoxDecoration(
                    color: panel,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: colors.outline.withValues(alpha: .7))),
                // [height] is the most the figures grow; narrow panels shrink
                // them so both views always fit side by side.
                child: LayoutBuilder(builder: (context, c) {
                  final fit = c.maxWidth.isFinite
                      ? c.maxWidth / (2 * _box.width / _box.height + .14)
                      : height;
                  final h = fit < height ? fit : height;
                  return FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        figure(true, h),
                        SizedBox(width: h * .12),
                        figure(false, h),
                      ]));
                }))));
  }
}

/// Recovery figure plus the overall estimate, shared by Inicio and Progreso.
class RecoveryBody extends StatelessWidget {
  const RecoveryBody({super.key, required this.items, this.height = 260});
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
        const SizedBox(height: 12),
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

// ---- Figure geometry -------------------------------------------------------
// Each figure lives in a 200 × 460 box, mirrored around x = 100. Shapes are
// listed as flat x,y outlines of the image-left half and smoothed into closed
// Catmull-Rom curves, so muscles read as rounded anatomical forms.

const _box = Size(200, 460);

/// Closed Catmull-Rom spline through [xy] (flat x,y pairs).
Path _spline(List<double> xy, {bool mirrored = false}) {
  final points = [
    for (var i = 0; i < xy.length; i += 2)
      Offset(mirrored ? _box.width - xy[i] : xy[i], xy[i + 1])
  ];
  final n = points.length;
  Offset p(int i) => points[(i + n) % n];
  final path = Path()..moveTo(p(0).dx, p(0).dy);
  for (var i = 0; i < n; i++) {
    final c1 = p(i) + (p(i + 1) - p(i - 1)) / 6;
    final c2 = p(i + 1) - (p(i + 2) - p(i)) / 6;
    path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p(i + 1).dx, p(i + 1).dy);
  }
  return path..close();
}

/// Shape crossing the axis: the half outline plus its mirror.
List<double> _symmetric(List<double> half) => [
      ...half,
      for (var i = half.length - 2; i >= 0; i -= 2) ...[
        _box.width - half[i],
        half[i + 1]
      ],
    ];

List<double> _ellipse(double cx, double cy, double rx, double ry) => [
      for (var i = 0; i < 16; i++) ...[
        cx + rx * _cos[i],
        cy + ry * _cos[(i + 12) % 16],
      ]
    ];
// cos(i·π/8); sin is the same table shifted by a quarter turn.
const _cos = [
  1.0, .9239, .7071, .3827, 0.0, -.3827, -.7071, -.9239, //
  -1.0, -.9239, -.7071, -.3827, 0.0, .3827, .7071, .9239,
];

List<double> _absRow(double top, double bottom, double left) => [
      left, top + 3, left + 3, top, 98.6, top, 98.6, bottom, //
      left + 3, bottom, left, bottom - 3,
    ];

const _limbs = <List<double>>[
  [52, 90, 38, 100, 32, 130, 33, 170, 44, 182, 56, 170, 58, 130], // arm
  [33, 172, 27, 202, 26, 232, 30, 254, 40, 256, 46, 232, 52, 200, 52, 176],
  [29, 252, 24, 270, 26, 290, 34, 296, 42, 286, 42, 262], // hand
  [
    62,
    240,
    58,
    273.4,
    61,
    316.7,
    67,
    350.9,
    86,
    355.5,
    96,
    328.1,
    99,
    278,
    90,
    262
  ],
  [
    67,
    344.1,
    63,
    380.6,
    68,
    419.3,
    73,
    435.3,
    85,
    435.3,
    90,
    410.2,
    94,
    373.7,
    91,
    346.4
  ],
  [72, 430.7, 65, 446.7, 71, 455.8, 90, 455.8, 88, 433], // foot
];

final List<Path> _silhouette = [
  _spline(_ellipse(100, 30, 17, 23)),
  _spline(_symmetric([90, 46, 89, 62, 84, 76])),
  _spline(_symmetric([
    86,
    70,
    64,
    80,
    52,
    92,
    55,
    132,
    60,
    170,
    66,
    206,
    62,
    236,
    64,
    262,
    92,
    278
  ])),
  for (final limb in _limbs) ...[_spline(limb), _spline(limb, mirrored: true)],
];

const _frontHalf = <(String, List<double>)>[
  ('Espalda', [90, 60, 70, 80, 80, 83, 89, 74]),
  (
    'Hombros',
    [66, 82, 52, 88, 38, 100, 34, 122, 40, 134, 46, 124, 54, 106, 64, 94]
  ),
  (
    'Pecho',
    [98.6, 90, 86, 84, 68, 88, 56, 104, 56, 122, 62, 134, 78, 140, 98.6, 134]
  ),
  ('Abdomen', [60, 138, 70, 144, 74, 168, 66, 170, 62, 154]), // serratus
  ('Bíceps', [38, 136, 48, 128, 56, 138, 56, 162, 50, 176, 42, 174, 36, 160]),
  ('Antebrazos', [34, 176, 44, 180, 42, 206, 34, 236, 29, 234, 28, 206]),
  (
    'Antebrazos',
    [46, 180, 54, 180, 50, 206, 44, 240, 36, 246, 38, 222, 44, 200]
  ),
  ('Abdomen', [88, 218, 91, 215, 98.6, 215, 98.6, 254, 95, 254, 90, 238]),
  ('Abdomen', [66, 172, 78, 168, 85, 176, 85, 236, 76, 244, 68, 226, 66, 200]),
  (
    'Cuádriceps',
    [58, 252, 70, 256, 77, 293.9, 76, 330.4, 68, 344.1, 59, 312.2, 56, 278]
  ),
  ('Cuádriceps', [71, 254, 85, 258, 91, 296.2, 86, 335, 77, 341.8, 74, 300.8]),
  (
    'Cuádriceps',
    [85, 298.5, 96, 307.6, 96, 339.5, 88, 355.5, 78, 348.6, 83, 325.8]
  ),
  (
    'Aductores',
    [84, 258, 99.5, 268.8, 98, 307.6, 90, 309.9, 85, 293.9, 82, 271.1]
  ),
  (
    'Pantorrillas',
    [68, 357.8, 77, 355.5, 80, 387.4, 78, 419.3, 73, 423.9, 68, 394.2]
  ),
  ('Pantorrillas', [80, 357.8, 91, 362.3, 93, 387.4, 88, 412.5, 82, 398.8]),
];

const _backHalf = <(String, List<double>)>[
  ('Espalda', [99, 58, 90, 64, 68, 82, 78, 92, 90, 118, 99, 150]),
  ('Hombros', [66, 84, 52, 88, 38, 100, 34, 122, 40, 134, 48, 122, 56, 104]),
  ('Espalda', [72, 96, 86, 116, 84, 136, 66, 134, 60, 114]),
  (
    'Espalda',
    [58, 132, 66, 140, 84, 144, 90, 168, 90, 206, 80, 212, 68, 192, 60, 160]
  ),
  ('Espalda', [91, 186, 98.6, 180, 98.6, 242, 91, 248, 87, 222]),
  ('Tríceps', [38, 134, 50, 126, 56, 136, 58, 160, 52, 176, 42, 176, 36, 158]),
  ('Antebrazos', [34, 178, 52, 178, 48, 210, 42, 244, 32, 240, 28, 206]),
  ('Glúteos', [64, 230, 84, 224, 88, 238, 68, 250]),
  (
    'Glúteos',
    [66, 250, 86, 240, 98.6, 246, 98.6, 289.4, 86, 298.5, 70, 291.6, 62, 268.8]
  ),
  (
    'Isquiotibiales',
    [60, 298.5, 78, 300.8, 80, 335, 74, 353.2, 65, 341.8, 59, 319]
  ),
  (
    'Isquiotibiales',
    [80, 300.8, 97, 298.5, 95, 330.4, 88, 353.2, 82, 348.6, 80, 319]
  ),
  (
    'Pantorrillas',
    [66, 360, 80, 357.8, 80, 387.4, 76, 410.2, 69, 398.8, 64, 378.3]
  ),
  ('Pantorrillas', [82, 357.8, 94, 362.3, 94, 387.4, 88, 412.5, 82, 394.2]),
  ('Pantorrillas', [70, 410.2, 92, 412.5, 88, 430.7, 74, 430.7]),
];

List<(String, Path)> _muscles(List<(String, List<double>)> half) => [
      for (final (group, xy) in half) ...[
        (group, _spline(xy)),
        (group, _spline(xy, mirrored: true)),
      ],
    ];

final _front = [
  ..._muscles(_frontHalf),
  for (final (top, bottom) in const [
    (146.0, 166.0),
    (169.0, 189.0),
    (192.0, 212.0)
  ]) ...[
    ('Abdomen', _spline(_absRow(top, bottom, 87.5))),
    ('Abdomen', _spline(_absRow(top, bottom, 87.5), mirrored: true)),
  ],
];
final _back = _muscles(_backHalf);

class _BodyPainter extends CustomPainter {
  _BodyPainter(
      {required this.front,
      required this.fill,
      required this.skin,
      required this.idle,
      required this.gap});
  final bool front;
  final Map<String, Color> fill;
  final Color skin, idle, gap;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / _box.width, size.height / _box.height);
    final paint = Paint()..isAntiAlias = true;
    paint.color = skin;
    for (final p in _silhouette) {
      canvas.drawPath(p, paint);
    }
    final separator = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeJoin = StrokeJoin.round
      ..color = gap;
    for (final (group, path) in front ? _front : _back) {
      paint
        ..shader = null
        ..color = idle;
      canvas.drawPath(path, paint);
      final color = fill[group];
      if (color != null) {
        paint.color = color;
        canvas.drawPath(path, paint);
      }
      // Top light and bottom shade give each muscle some volume.
      final bounds = path.getBounds();
      paint.shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: color == null ? .05 : .16),
            Colors.transparent,
            Colors.black.withValues(alpha: color == null ? .12 : .22),
          ],
          stops: const [
            0,
            .45,
            1
          ]).createShader(bounds);
      canvas.drawPath(path, paint);
      canvas.drawPath(path, separator);
    }
  }

  @override
  bool shouldRepaint(_BodyPainter old) =>
      old.front != front ||
      old.skin != skin ||
      old.idle != idle ||
      old.gap != gap ||
      old.fill.length != fill.length ||
      old.fill.entries.any((e) => fill[e.key] != e.value);
}

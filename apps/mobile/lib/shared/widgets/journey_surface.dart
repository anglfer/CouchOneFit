import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Las líneas recorren una pista una sola vez al aparecer la tarjeta.
class JourneySurface extends StatelessWidget {
  const JourneySurface({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: DecoratedBox(
        decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
              Color(0xFF151D46),
              Color(0xFF25225C),
              Color(0xFF4933AA)
            ],
                stops: [
              0,
              0.60,
              1
            ])),
        child: Stack(
          children: [
            Positioned.fill(
                child: ExcludeSemantics(
                    child: IgnorePointer(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: reduced ? 1 : 0, end: 1),
                duration: reduced
                    ? Duration.zero
                    : const Duration(milliseconds: 1400),
                curve: Curves.easeOutCubic,
                builder: (context, value, _) =>
                    CustomPaint(painter: _JourneyPainter(value)),
              ),
            ))),
            DefaultTextStyle.merge(
                style: const TextStyle(color: Colors.white), child: child),
          ],
        ),
      ),
    );
  }
}

class _JourneyPainter extends CustomPainter {
  const _JourneyPainter(this.progress);
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.translate(size.width * 0.95, size.height * 0.38);
    canvas.rotate(-math.pi / 5);
    for (var i = 0; i < 8; i++) {
      final width = size.width * 0.40 + i * 24;
      final height = size.height * 1.7 + i * 24;
      final path = Path()
        ..addRRect(RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset.zero, width: width, height: height),
            Radius.circular(width / 2)));
      canvas.drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = i == 3 ? 2 : 1
            ..color = const Color(0xFFB2A0FF)
                .withValues(alpha: i == 3 ? 0.35 : 0.12));
      if (i == 3) {
        final metric = path.computeMetrics().first;
        canvas.drawPath(
            metric.extractPath(
                metric.length * 0.12, metric.length * (0.12 + progress * 0.32)),
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeCap = StrokeCap.round
              ..strokeWidth = 3
              ..color = const Color(0xFFC9BEFF));
      }
    }
    canvas.restore();
    // Despeja el lado de lectura sin cubrir la ilustración a la derecha.
    canvas.drawRect(
        Offset.zero & size,
        Paint()
          ..shader = const LinearGradient(
              colors: [Color(0xC7151D46), Color(0x00151D46)],
              stops: [0, 0.82]).createShader(Offset.zero & size));
  }

  @override
  bool shouldRepaint(_JourneyPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

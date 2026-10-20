import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

/// Entrada cinematográfica: el hijo aparece desenfocado, desplazado y algo
/// reducido, y se "enfoca" en su lugar. El retraso se modela con un `Interval`
/// (sin timers), así que es seguro en pruebas y al desmontar.
class RevealIn extends StatefulWidget {
  const RevealIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 480),
    this.offset = const Offset(0, 18),
    this.beginScale = 0.985,
    this.blur = 0,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final Offset offset;
  final double beginScale;
  final double blur;

  @override
  State<RevealIn> createState() => _RevealInState();
}

class _RevealInState extends State<RevealIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final CurvedAnimation _t;

  @override
  void initState() {
    super.initState();
    final total = widget.delay + widget.duration;
    _controller = AnimationController(vsync: this, duration: total);
    final start = total.inMicroseconds == 0
        ? 0.0
        : widget.delay.inMicroseconds / total.inMicroseconds;
    _t = CurvedAnimation(
      parent: _controller,
      curve: Interval(start, 1, curve: Curves.easeOutQuart),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    } else if (_controller.isDismissed) {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _t.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) {
        final t = _t.value;
        final inv = 1 - t;
        final sigma = widget.blur * inv;
        return Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: widget.offset * inv,
            child: Transform.scale(
              scale: widget.beginScale + (1 - widget.beginScale) * t,
              child: ImageFiltered(
                enabled: sigma > 0.05,
                imageFilter: ImageFilter.blur(
                  sigmaX: sigma + 0.001,
                  sigmaY: sigma + 0.001,
                ),
                child: child,
              ),
            ),
          ),
        );
      },
    );
  }
}

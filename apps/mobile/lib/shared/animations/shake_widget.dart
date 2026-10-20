import 'dart:math' as math;
import 'package:flutter/material.dart';

import 'animation_utils.dart';

/// Un widget que sacude horizontalmente a su hijo con física elástica cuando
/// cambia [triggerKey] a un valor no nulo y distinto al anterior.
class ShakeWidget extends StatefulWidget {
  const ShakeWidget({
    super.key,
    required this.child,
    this.triggerKey,
    this.duration = const Duration(milliseconds: 450),
    this.amplitude = 8.0,
  });

  final Widget child;
  final Object? triggerKey;
  final Duration duration;
  final double amplitude;

  @override
  State<ShakeWidget> createState() => _ShakeWidgetState();
}

class _ShakeWidgetState extends State<ShakeWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    if (widget.triggerKey != null && !isTestEnvironment) {
      _controller.forward(from: 0.0);
    }
  }

  @override
  void didUpdateWidget(covariant ShakeWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.triggerKey != null &&
        widget.triggerKey != oldWidget.triggerKey &&
        !isTestEnvironment &&
        !MediaQuery.disableAnimationsOf(context)) {
      _controller.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (isTestEnvironment || MediaQuery.disableAnimationsOf(context)) {
      return widget.child;
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        // Amortiguamiento elástico senoidal que decae a 0
        final decay = 1.0 - t;
        final dx = math.sin(t * math.pi * 6) * widget.amplitude * decay;
        return Transform.translate(
          offset: Offset(dx, 0),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

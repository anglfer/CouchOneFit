import 'package:flutter/material.dart';

/// Añade una sutil física táctil que se contrae al presionar y rebota al soltar.
class TactileBounce extends StatefulWidget {
  const TactileBounce({
    super.key,
    required this.child,
    this.onTap,
    this.scaleFactor = 0.975,
    this.enabled = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scaleFactor;
  final bool enabled;

  @override
  State<TactileBounce> createState() => _TactileBounceState();
}

class _TactileBounceState extends State<TactileBounce>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _scaleAnimation =
        Tween<double>(begin: 1.0, end: widget.scaleFactor).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.easeInOut,
        reverseCurve: Curves.easeOutBack,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(PointerDownEvent details) {
    if (!widget.enabled || MediaQuery.disableAnimationsOf(context)) return;
    _controller.forward();
  }

  void _onTapUp(PointerEvent details) {
    if (!widget.enabled || MediaQuery.disableAnimationsOf(context)) return;
    _controller.reverse();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) _controller.value = 0;
  }

  @override
  void didUpdateWidget(covariant TactileBounce oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.enabled) _controller.value = 0;
  }

  @override
  Widget build(BuildContext context) {
    // Listener observa la presión sin competir con el gesto del botón hijo.
    Widget result = Listener(
      onPointerDown: _onTapDown,
      onPointerUp: _onTapUp,
      onPointerCancel: _onTapUp,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: widget.child,
      ),
    );
    if (widget.onTap != null) {
      result = Semantics(
        button: true,
        child: GestureDetector(
          onTap: widget.enabled ? widget.onTap : null,
          behavior: HitTestBehavior.opaque,
          child: result,
        ),
      );
    }
    return result;
  }
}

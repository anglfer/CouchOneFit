import 'package:flutter/material.dart';

/// Transición de página "zoom-through": la nueva pantalla emerge desde abajo
/// con escala y fundido; al volver se retira con la curva inversa.
Route<T> premiumRoute<T>(WidgetBuilder builder) {
  return PageRouteBuilder<T>(
    transitionDuration: const Duration(milliseconds: 380),
    reverseTransitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (context, _, __) => builder(context),
    transitionsBuilder: (context, animation, secondary, child) {
      if (MediaQuery.disableAnimationsOf(context)) return child;
      final curved = animation.drive(CurveTween(
        curve: Curves.easeOutQuart,
      ));
      final behind = secondary.drive(CurveTween(curve: Curves.easeOut));
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.08, 0.015),
            end: Offset.zero,
          ).animate(curved),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.985, end: 1).animate(curved),
            child: ScaleTransition(
              scale: Tween<double>(begin: 1, end: 0.96).animate(behind),
              child: child,
            ),
          ),
        ),
      );
    },
  );
}

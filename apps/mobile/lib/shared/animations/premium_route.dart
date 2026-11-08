import 'package:flutter/material.dart';

/// Transición "zoom-through": la nueva pantalla emerge con desplazamiento,
/// escala y fundido; la anterior retrocede levemente al fondo.
Widget premiumTransition(BuildContext context, Animation<double> animation,
    Animation<double> secondary, Widget child) {
  if (MediaQuery.disableAnimationsOf(context)) return child;
  final curved = animation.drive(CurveTween(curve: Curves.easeOutQuart));
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
}

Route<T> premiumRoute<T>(WidgetBuilder builder) {
  return PageRouteBuilder<T>(
    transitionDuration: const Duration(milliseconds: 380),
    reverseTransitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (context, _, __) => builder(context),
    transitionsBuilder: premiumTransition,
  );
}

/// Registrado en el tema: cualquier `MaterialPageRoute` usa el mismo
/// movimiento que [premiumRoute].
class PremiumPageTransitionsBuilder extends PageTransitionsBuilder {
  const PremiumPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
          PageRoute<T> route,
          BuildContext context,
          Animation<double> animation,
          Animation<double> secondaryAnimation,
          Widget child) =>
      premiumTransition(context, animation, secondaryAnimation, child);
}

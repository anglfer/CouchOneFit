import 'package:flutter/material.dart';

/// Pone [primary] y [secondary] lado a lado cuando el espacio disponible
/// (tablet, horizontal, ventana grande) deja ambas columnas con ancho de
/// tarjeta de teléfono; si no, las apila con [primary] primero y [spacing]
/// entre ambas, igual que la pantalla de teléfono.
class AdaptiveColumns extends StatelessWidget {
  const AdaptiveColumns(
      {super.key,
      required this.primary,
      required this.secondary,
      this.spacing = 14});
  final List<Widget> primary;
  final List<Widget> secondary;
  final double spacing;

  /// Ancho mínimo para dos columnas de ~400 px más el espacio entre ellas.
  static const minWidth = 820.0;

  @override
  Widget build(BuildContext context) {
    Widget column(List<Widget> children) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
    return LayoutBuilder(
        builder: (context, constraints) => constraints.maxWidth < minWidth
            ? column([...primary, SizedBox(height: spacing), ...secondary])
            : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: column(primary)),
                const SizedBox(width: 16),
                Expanded(child: column(secondary)),
              ]));
  }
}

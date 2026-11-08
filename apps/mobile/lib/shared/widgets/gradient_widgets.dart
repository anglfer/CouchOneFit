import 'package:flutter/material.dart';

import '../animations/tactile_bounce.dart';
import '../theme/app_theme.dart';

/// Acción principal: una sola tecla de marca con respuesta de presión y estado
/// de carga. [inverse] la invierte a blanco sobre una superficie de pista.
class GradientActionButton extends StatelessWidget {
  const GradientActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.buttonKey,
    this.busy = false,
    this.busyLabel,
    this.inverse = false,
    this.icon = Icons.arrow_forward_rounded,
  });

  final String label;
  final VoidCallback? onPressed;
  final Key? buttonKey;
  final bool busy;
  final String? busyLabel;
  final bool inverse;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final disabled = busy || onPressed == null;
    const ink = Color(0xFF120B2B);
    final foreground = inverse ? ink : Colors.white;
    final disabledForeground =
        inverse ? const Color(0xCCFFFFFF) : scheme.onSurfaceVariant;
    final tone = disabled ? disabledForeground : foreground;

    return TactileBounce(
      enabled: !disabled,
      child: AnimatedContainer(
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          // Same hue top to bottom: white keeps at least 4.5:1 on both stops.
          gradient: disabled || inverse
              ? null
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    actionFill(context),
                    dark ? const Color(0xFF5A3CE0) : const Color(0xFF3128D9),
                  ],
                ),
          color: disabled
              ? inverse
                  ? const Color(0x33FFFFFF)
                  : scheme.surfaceContainerHighest
              : inverse
                  ? Colors.white
                  : null,
          boxShadow: disabled
              ? const []
              : [
                  BoxShadow(
                    color: (inverse ? Colors.black : scheme.primary)
                        .withValues(alpha: dark || inverse ? 0.32 : 0.22),
                    blurRadius: 22,
                    offset: const Offset(0, 8),
                  ),
                ],
        ),
        child: FilledButton(
          key: buttonKey,
          onPressed: disabled ? null : onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size(48, 56),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
            backgroundColor: Colors.transparent,
            disabledBackgroundColor: Colors.transparent,
            foregroundColor: foreground,
            disabledForegroundColor: disabledForeground,
            shadowColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy) ...[
                SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    color: tone,
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(child: Text(busy ? (busyLabel ?? label) : label)),
              if (!busy) ...[
                const SizedBox(width: 10),
                Icon(icon, size: 20),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

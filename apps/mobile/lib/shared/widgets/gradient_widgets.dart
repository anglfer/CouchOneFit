import 'package:flutter/material.dart';

import '../animations/tactile_bounce.dart';
import '../theme/app_theme.dart';

/// Acción principal de marca con respuesta de presión y estado de carga.
class GradientActionButton extends StatelessWidget {
  const GradientActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.buttonKey,
    this.busy = false,
    this.busyLabel,
    this.icon = Icons.arrow_forward_rounded,
  });

  final String label;
  final VoidCallback? onPressed;
  final Key? buttonKey;
  final bool busy;
  final String? busyLabel;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final disabled = busy || onPressed == null;

    return TactileBounce(
      enabled: !disabled,
      child: AnimatedContainer(
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: disabled ? null : BrandColors.gradient,
          color: disabled ? scheme.surfaceContainerHighest : null,
          boxShadow: disabled
              ? const []
              : [
                  BoxShadow(
                    color: BrandColors.primary
                        .withValues(alpha: isDark ? 0.18 : 0.16),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
        ),
        child: FilledButton(
          key: buttonKey,
          onPressed: disabled ? null : onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size(48, 56),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 17),
            backgroundColor: Colors.transparent,
            disabledBackgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            disabledForegroundColor: scheme.onSurfaceVariant,
            shadowColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
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
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(child: Text(busy ? (busyLabel ?? label) : label)),
              if (!busy) ...[
                const SizedBox(width: 10),
                Icon(icon, size: 19),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Rounded icon tile used to lead rows and states. [filled] marks the one
/// active item in a group; otherwise a soft [tint].
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon,
      {super.key, this.tint, this.size = 40, this.filled = false});
  final IconData icon;
  final Color? tint;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = tint ?? colors.secondary;
    return ExcludeSemantics(
        child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
                color: filled
                    ? actionFill(context)
                    : color.withValues(alpha: dark ? .16 : .1),
                borderRadius: BorderRadius.circular(size * .3)),
            child: Icon(icon,
                size: size * .5,
                color: filled ? Colors.white : statusInk(context, color))));
  }
}

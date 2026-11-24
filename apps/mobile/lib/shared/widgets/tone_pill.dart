import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Small status label: always text, with the tone as reinforcement only.
class TonePill extends StatelessWidget {
  const TonePill(this.text, {super.key, this.tone, this.icon});
  final String text;
  final Color? tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = tone ?? colors.secondary;
    final ink = statusInk(context, base);
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
            color: base.withValues(alpha: .15),
            border: Border.all(color: base.withValues(alpha: dark ? .30 : .22)),
            borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: ink),
            const SizedBox(width: 5),
          ],
          Flexible(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color: ink))),
        ]));
  }
}

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum NoticeTone { info, success, warning, error }

/// Inline status message: soft state background (DESIGN.md «Estados
/// compartidos»), theme text on top, an icon so color is never the only cue,
/// and an optional retry action.
class NoticeBanner extends StatelessWidget {
  const NoticeBanner(
      {super.key,
      required this.text,
      this.icon,
      this.tone = NoticeTone.info,
      this.retryLabel = 'Reintentar',
      this.onRetry,
      this.margin = const EdgeInsets.symmetric(vertical: 6)});
  final String text;
  final IconData? icon;
  final NoticeTone tone;
  final String retryLabel;
  final VoidCallback? onRetry;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (accent, fallbackIcon) = switch (tone) {
      NoticeTone.info => (colors.secondary, Icons.info_outline_rounded),
      NoticeTone.success => (BrandColors.success, Icons.check_circle_outline),
      NoticeTone.warning => (BrandColors.warning, Icons.warning_amber_rounded),
      NoticeTone.error => (BrandColors.error, Icons.error_outline_rounded),
    };
    final background =
        (dark ? BrandColors.statusDark : BrandColors.statusLight)[tone.name]!;
    return Semantics(
        liveRegion: true,
        child: Container(
            margin: margin,
            padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
            decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: accent.withValues(alpha: dark ? .38 : .3))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                      color: accent.withValues(alpha: dark ? .22 : .16),
                      shape: BoxShape.circle),
                  child: Icon(icon ?? fallbackIcon, size: 17, color: accent)),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Text(text,
                            style: TextStyle(
                                color: colors.onSurface,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w500,
                                height: 1.4))),
                    if (onRetry != null)
                      Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: TextButton.icon(
                              onPressed: onRetry,
                              style: TextButton.styleFrom(
                                  foregroundColor: colors.onSurface,
                                  backgroundColor:
                                      accent.withValues(alpha: dark ? .2 : .14),
                                  minimumSize: const Size(48, 40),
                                  visualDensity: VisualDensity.compact),
                              icon: const Icon(Icons.refresh_rounded, size: 18),
                              label: Text(retryLabel))),
                  ])),
            ])));
  }
}

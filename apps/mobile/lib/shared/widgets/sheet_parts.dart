import 'package:flutter/material.dart';

/// Title row of every bottom sheet: heading, close button and an optional
/// explanation underneath.
class SheetHeader extends StatelessWidget {
  const SheetHeader(this.title, {super.key, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
                child: Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Semantics(
                        header: true,
                        child: Text(title,
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontSize: 20))))),
            const SizedBox(width: 8),
            IconButton.filledTonal(
                tooltip: 'Cerrar',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, size: 20)),
          ]),
          if (subtitle != null)
            Padding(
                padding: const EdgeInsets.only(top: 2, right: 56),
                child: Text(subtitle!,
                    style: TextStyle(
                        fontSize: 13.5,
                        height: 1.4,
                        color: colors.onSurfaceVariant))),
        ]));
  }
}

/// Tappable choice inside a sheet, drawn as a layered panel.
class SheetOption extends StatelessWidget {
  const SheetOption(
      {super.key,
      required this.title,
      required this.leading,
      required this.onTap,
      this.subtitle,
      this.selected = false});
  final String title;
  final String? subtitle;
  final Widget leading;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Material(
            color: selected
                ? colors.primaryContainer
                : colors.surfaceContainerHighest,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(
                    color: selected
                        ? colors.primary.withValues(alpha: .6)
                        : colors.outline,
                    width: selected ? 1.5 : 1)),
            clipBehavior: Clip.antiAlias,
            child: ListTile(
                selected: selected,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                leading: leading,
                title: Text(title),
                subtitle: subtitle == null ? null : Text(subtitle!),
                trailing: Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.chevron_right_rounded,
                    color:
                        selected ? colors.secondary : colors.onSurfaceVariant),
                onTap: onTap)));
  }
}

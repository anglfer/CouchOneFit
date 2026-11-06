import 'package:flutter/material.dart';

/// Reserved slot for a module that is planned but not built yet. It never
/// shows sample data: only what the section will hold.
class ComingSoonCard extends StatelessWidget {
  const ComingSoonCard(
      {super.key,
      required this.icon,
      required this.title,
      required this.description});
  final IconData icon;
  final String title, description;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    return Semantics(
        label: '$title. Próximamente. $description',
        child: ExcludeSemantics(
            child: Card(
                margin: const EdgeInsets.only(bottom: 8),
                color: colors.surface.withValues(alpha: dark ? 0.72 : 0.88),
                child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                  color: colors.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(11),
                                  border: Border.all(
                                      color: colors.outline
                                          .withValues(alpha: 0.7))),
                              child: Icon(icon,
                                  size: 19, color: colors.secondary)),
                          const SizedBox(width: 12),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Wrap(
                                    spacing: 8,
                                    runSpacing: 4,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      Text(title,
                                          style: const TextStyle(
                                              fontSize: 14.5,
                                              fontWeight: FontWeight.w700)),
                                      Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                              color: colors
                                                  .surfaceContainerHighest,
                                              border: Border.all(
                                                  color: colors.outline),
                                              borderRadius:
                                                  BorderRadius.circular(99)),
                                          child: Text('Próximamente',
                                              style: TextStyle(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w700,
                                                  letterSpacing: 0.2,
                                                  color: theme.hintColor))),
                                    ]),
                                const SizedBox(height: 3),
                                Text(description,
                                    style: TextStyle(
                                        fontSize: 12.5,
                                        height: 1.35,
                                        color: colors.onSurfaceVariant)),
                              ])),
                        ])))));
  }
}

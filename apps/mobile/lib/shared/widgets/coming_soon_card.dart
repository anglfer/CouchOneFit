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
    final colors = Theme.of(context).colorScheme;
    return Semantics(
        label: '$title. Próximamente. $description',
        child: ExcludeSemantics(
            child: Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                              color: colors.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(12)),
                          child: Icon(icon, color: colors.onSurfaceVariant)),
                      const SizedBox(width: 14),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Wrap(
                                spacing: 8,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(title,
                                      style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700)),
                                  Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                          border:
                                              Border.all(color: colors.outline),
                                          borderRadius:
                                              BorderRadius.circular(99)),
                                      child: Text('Próximamente',
                                          style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: colors.onSurfaceVariant))),
                                ]),
                            const SizedBox(height: 4),
                            Text(description,
                                style:
                                    TextStyle(color: colors.onSurfaceVariant)),
                          ])),
                    ])))));
  }
}

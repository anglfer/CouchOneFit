import 'package:flutter/material.dart';

import 'icon_badge.dart';

/// Centered full-area state (loading, error, empty) with a title, an
/// explanation and its actions, so no screen is ever a bare spinner.
class StatusView extends StatelessWidget {
  const StatusView(
      {super.key,
      required this.title,
      this.message,
      this.icon = Icons.info_outline_rounded,
      this.tint,
      this.loading = false,
      this.actions = const []});
  final String title;
  final String? message;
  final IconData icon;
  final Color? tint;
  final bool loading;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final content = ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (loading)
            SizedBox.square(
                dimension: 72,
                child: Stack(fit: StackFit.expand, children: [
                  const CircularProgressIndicator(
                      strokeWidth: 3, strokeCap: StrokeCap.round),
                  Padding(
                      padding: const EdgeInsets.all(20),
                      child: Image.asset('assets/brand/logomark.png',
                          excludeFromSemantics: true)),
                ]))
          else
            IconBadge(icon, tint: tint, size: 64),
          const SizedBox(height: 18),
          Semantics(
              liveRegion: true,
              child: Column(children: [
                Text(title,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleLarge),
                if (message != null) ...[
                  const SizedBox(height: 8),
                  Text(message!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          height: 1.45, color: colors.onSurfaceVariant)),
                ],
              ])),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 22),
            for (final (i, action) in actions.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              SizedBox(width: double.infinity, child: action),
            ],
          ],
        ]));
    // Inside a list the parent scrolls; alone it scrolls itself so large text
    // or the keyboard never clip the actions.
    return LayoutBuilder(
        builder: (context, constraints) => constraints.hasBoundedHeight
            ? Center(
                child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24), child: content))
            : Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: content)));
  }
}

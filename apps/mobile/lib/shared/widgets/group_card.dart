import 'package:flutter/material.dart';

/// One card holding related rows split by hairlines, instead of a stack of
/// separate boxes.
class GroupCard extends StatelessWidget {
  const GroupCard({super.key, required this.children, this.indent = 0});
  final List<Widget> children;
  final double indent;

  @override
  Widget build(BuildContext context) => Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final (i, child) in children.indexed) ...[
          if (i > 0) Divider(height: 1, indent: indent),
          child,
        ],
      ]));
}

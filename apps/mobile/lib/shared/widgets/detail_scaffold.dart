import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Pushed screen shell: back bar over the brand glow and a centered scrolling
/// column that follows safe areas and the keyboard.
class DetailScaffold extends StatelessWidget {
  const DetailScaffold(
      {super.key,
      required this.children,
      this.title,
      this.maxWidth = 560,
      this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 32)});
  final Widget? title;
  final List<Widget> children;
  final double maxWidth;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(backgroundColor: Colors.transparent, title: title),
      body: DecoratedBox(
          decoration: brandGlow(context),
          child: SafeArea(
              child: ListView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: padding,
                  children: [
                Center(
                    child: ConstrainedBox(
                        constraints: BoxConstraints(maxWidth: maxWidth),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: children))),
              ]))));
}

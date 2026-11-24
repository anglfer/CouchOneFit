import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Pushed screen shell: back bar over the brand glow and a centered scrolling
/// column that follows safe areas and the keyboard.
class DetailScaffold extends StatefulWidget {
  const DetailScaffold(
      {super.key,
      required this.children,
      this.title,
      this.maxWidth = 560,
      this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 32),
      this.bottomNavigationBar});
  final Widget? title;
  final List<Widget> children;
  final double maxWidth;
  final EdgeInsetsGeometry padding;
  final Widget? bottomNavigationBar;

  @override
  State<DetailScaffold> createState() => _DetailScaffoldState();
}

class _DetailScaffoldState extends State<DetailScaffold> {
  bool _scrolled = false;

  bool _onScroll(ScrollNotification notification) {
    if (notification.depth != 0 || notification.metrics.axis != Axis.vertical) {
      return false;
    }
    final next = notification.metrics.pixels > 6;
    if (next != _scrolled) setState(() => _scrolled = next);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final reduced = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      extendBodyBehindAppBar: true,
      bottomNavigationBar: widget.bottomNavigationBar,
      appBar: AppBar(
        backgroundColor: _scrolled
            ? colors.surface.withValues(alpha: dark ? 0.94 : 0.96)
            : Colors.transparent,
        title: widget.title,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: AnimatedOpacity(
            duration:
                reduced ? Duration.zero : const Duration(milliseconds: 180),
            opacity: _scrolled ? 1 : 0,
            child: Divider(
              height: 1,
              thickness: 1,
              color: colors.outlineVariant,
            ),
          ),
        ),
      ),
      body: DecoratedBox(
        decoration: brandGlow(context),
        child: SafeArea(
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScroll,
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: widget.padding,
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: widget.maxWidth),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: widget.children,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

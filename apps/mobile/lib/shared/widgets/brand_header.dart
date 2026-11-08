import 'package:flutter/material.dart';

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, this.onBrand = false});

  /// Single-ink logomark for the brand surface.
  final bool onBrand;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Image.asset(
              onBrand
                  ? 'assets/brand/logomark_white.png'
                  : 'assets/brand/logomark.png',
              width: 40,
              excludeFromSemantics: true),
          const SizedBox(width: 10),
          const Flexible(
              child: Text('CouchOne Fit',
                  style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4))),
        ],
      );
}

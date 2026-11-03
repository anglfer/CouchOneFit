import 'package:flutter/material.dart';

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Image.asset('assets/brand/logomark.png',
              width: 46, excludeFromSemantics: true),
          const SizedBox(width: 12),
          const Flexible(
              child: Text('CouchOne Fit',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.7))),
        ],
      );
}

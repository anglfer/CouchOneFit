import 'package:flutter/material.dart';

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
              width: 44,
              height: 44,
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(
                      color: Theme.of(context).colorScheme.outlineVariant)),
              child:
                  Image.asset('assets/logo.png', excludeFromSemantics: true)),
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

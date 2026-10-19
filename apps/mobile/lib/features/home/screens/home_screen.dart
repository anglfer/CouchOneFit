import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onThemeChanged});

  final ValueChanged<ThemeMode> onThemeChanged;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        actions: [
          Builder(builder: (context) {
            final dark = Theme.of(context).brightness == Brightness.dark;
            return IconButton(
              tooltip: dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
              icon: Icon(
                  dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
              onPressed: () => onThemeChanged(
                dark ? ThemeMode.light : ThemeMode.dark,
              ),
            );
          }),
        ],
      ),
      body: SafeArea(
          child: Center(
              child: SingleChildScrollView(
        child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(
                  'assets/logo.png',
                  width: 300,
                  semanticLabel: 'CouchOne Fit',
                ),
                const SizedBox(height: 24),
                const Text(
                  'CouchOne Fit - Móvil',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            )),
      ))),
    );
  }
}

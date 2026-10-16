import 'package:flutter/material.dart';
import 'shared/theme/app_theme.dart';

void main() {
  runApp(const CouchOneFitApp());
}

class CouchOneFitApp extends StatefulWidget {
  const CouchOneFitApp({super.key});

  @override
  State<CouchOneFitApp> createState() => _CouchOneFitAppState();
}

class _CouchOneFitAppState extends State<CouchOneFitApp> {
  // shortcut: la elección dura esta sesión; persistir al incorporar ajustes locales.
  ThemeMode _themeMode = ThemeMode.system;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CouchOne Fit',
      debugShowCheckedModeBanner: false,
      theme: mobileTheme(Brightness.light),
      darkTheme: mobileTheme(Brightness.dark),
      themeMode: _themeMode,
      home: Scaffold(
        appBar: AppBar(
          actions: [
            Builder(builder: (context) {
              final dark = Theme.of(context).brightness == Brightness.dark;
              return IconButton(
                tooltip:
                    dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
                icon: Icon(dark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined),
                onPressed: () => setState(() {
                  _themeMode = dark ? ThemeMode.light : ThemeMode.dark;
                }),
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
      ),
    );
  }
}

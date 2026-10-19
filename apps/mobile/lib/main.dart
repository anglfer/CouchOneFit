import 'package:flutter/material.dart';
import 'shared/theme/app_theme.dart';
import 'features/home/screens/home_screen.dart';

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
      home: HomeScreen(
        onThemeChanged: (themeMode) => setState(() {
          _themeMode = themeMode;
        }),
      ),
    );
  }
}

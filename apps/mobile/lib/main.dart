import 'package:flutter/material.dart';

void main() {
  runApp(const CouchOneFitApp());
}

class CouchOneFitApp extends StatelessWidget {
  const CouchOneFitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CouchOne Fit',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F172A),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: Scaffold(
        body: Center(
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
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../widgets/login_form.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({
    super.key,
    required this.isSubmitting,
    required this.onSubmit,
    this.errorMessage,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final Future<void> Function(String identifier, String password) onSubmit;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/logo.png',
                height: 56,
                semanticLabel: 'CouchOne Fit',
              ),
              const SizedBox(height: 8),
              const Text(
                'CouchOne Fit - Móvil',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              LoginForm(
                isSubmitting: isSubmitting,
                errorMessage: errorMessage,
                onSubmit: onSubmit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

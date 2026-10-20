import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../../../shared/animations/tactile_bounce.dart';
import '../../../shared/widgets/brand_header.dart';
import '../widgets/login_form.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen(
      {super.key,
      required this.isSubmitting,
      required this.onSubmit,
      this.errorMessage,
      this.statusMessage,
      this.onActivate,
      this.onRecover});
  final bool isSubmitting;
  final String? errorMessage;
  final String? statusMessage;
  final VoidCallback? onActivate;
  final VoidCallback? onRecover;
  final Future<void> Function(String identifier, String password) onSubmit;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(
          MediaQuery.sizeOf(context).width < 360 ? 16 : 24,
          12,
          MediaQuery.sizeOf(context).width < 360 ? 16 : 24,
          28),
      child: Center(
          child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BrandHeader(),
          const SizedBox(height: 32),
          RevealIn(
              child: Semantics(
                  header: true,
                  child: Text('Qué bueno\nverte de vuelta.',
                      style: TextStyle(
                          fontSize: 36,
                          height: 1.1,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1.4,
                          color: scheme.onSurface)))),
          const SizedBox(height: 12),
          Text('Entra a tu cuenta y continúa donde lo dejaste.',
              style: TextStyle(
                  fontSize: 15, height: 1.5, color: scheme.onSurfaceVariant)),
          const SizedBox(height: 28),
          if (statusMessage != null) ...[
            Semantics(
                liveRegion: true,
                child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                        color: scheme.primaryContainer,
                        borderRadius: BorderRadius.circular(16)),
                    child: Text(statusMessage!,
                        style: TextStyle(
                            height: 1.5, color: scheme.onPrimaryContainer)))),
            const SizedBox(height: 16),
          ],
          RevealIn(
              delay: const Duration(milliseconds: 90),
              child: LoginForm(
                  isSubmitting: isSubmitting,
                  errorMessage: errorMessage,
                  onSubmit: onSubmit)),
          Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                  onPressed: isSubmitting ? null : onRecover,
                  child: const Text('Recuperar mi acceso'))),
          const SizedBox(height: 20),
          Divider(color: scheme.outlineVariant),
          const SizedBox(height: 20),
          Text('¿Es tu primera vez?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
          const SizedBox(height: 10),
          TactileBounce(
              enabled: !isSubmitting,
              child: OutlinedButton.icon(
                  onPressed: isSubmitting ? null : onActivate,
                  style: OutlinedButton.styleFrom(
                      foregroundColor: scheme.onSurface,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16))),
                  icon: const Icon(Icons.mark_email_unread_outlined, size: 20),
                  label: const Text('Activar mi cuenta'))),
        ]),
      )),
    );
  }
}

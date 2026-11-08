import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../../../shared/animations/tactile_bounce.dart';
import '../../../shared/widgets/brand_header.dart';
import '../../../shared/widgets/notice_banner.dart';
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
    final gutter = MediaQuery.sizeOf(context).width < 360 ? 16.0 : 24.0;
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(gutter, 8, gutter, 28),
      child: Center(
          child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BrandHeader(),
          const SizedBox(height: 28),
          RevealIn(
              child: Semantics(
                  header: true,
                  child: Text('Qué bueno\nverte de vuelta.',
                      style: Theme.of(context)
                          .textTheme
                          .displaySmall
                          ?.copyWith(fontSize: 34, height: 1.1)))),
          const SizedBox(height: 10),
          Text('Entra a tu cuenta y continúa donde lo dejaste.',
              style: TextStyle(
                  fontSize: 15, height: 1.5, color: scheme.onSurfaceVariant)),
          const SizedBox(height: 24),
          if (statusMessage != null)
            NoticeBanner(
                text: statusMessage!,
                icon: Icons.verified_user_outlined,
                margin: const EdgeInsets.only(bottom: 14)),
          RevealIn(
              delay: const Duration(milliseconds: 90),
              child: LoginForm(
                  isSubmitting: isSubmitting,
                  errorMessage: errorMessage,
                  onSubmit: onSubmit,
                  onRecover: onRecover)),
          const SizedBox(height: 28),
          Row(children: [
            const Expanded(child: Divider()),
            Flexible(
                flex: 3,
                child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('¿Es tu primera vez?',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: scheme.onSurfaceVariant)))),
            const Expanded(child: Divider()),
          ]),
          const SizedBox(height: 14),
          TactileBounce(
              enabled: !isSubmitting,
              child: OutlinedButton.icon(
                  onPressed: isSubmitting ? null : onActivate,
                  icon: const Icon(Icons.mark_email_unread_outlined, size: 20),
                  label: const Text('Activar mi cuenta'))),
        ]),
      )),
    );
  }
}

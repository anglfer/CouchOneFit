import 'package:flutter/material.dart';

import '../../../shared/animations/shake_widget.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/notice_banner.dart';

class LoginForm extends StatefulWidget {
  const LoginForm({
    super.key,
    required this.isSubmitting,
    required this.onSubmit,
    this.errorMessage,
    this.onRecover,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final VoidCallback? onRecover;
  final Future<void> Function(String identifier, String password) onSubmit;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  String? _validationError;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (widget.isSubmitting) return;
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;
    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _validationError = 'Ingresa tu usuario o correo y tu contraseña.';
      });
      return;
    }
    setState(() {
      _validationError = null;
    });
    FocusManager.instance.primaryFocus?.unfocus();
    await widget.onSubmit(identifier, password);
  }

  @override
  Widget build(BuildContext context) {
    final activeError = _validationError ?? widget.errorMessage;

    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (activeError != null) ...[
            ShakeWidget(
              triggerKey: activeError,
              child: NoticeBanner(
                key: const ValueKey('login_error_banner'),
                text: activeError,
                tone: NoticeTone.error,
                margin: EdgeInsets.zero,
              ),
            ),
            const SizedBox(height: 14),
          ],
          TextField(
            key: const ValueKey('login_identifier_field'),
            controller: _identifierController,
            autofillHints: const [AutofillHints.username],
            enabled: !widget.isSubmitting,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'Usuario o correo',
              hintText: 'ejemplo@correo.com',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const ValueKey('login_password_field'),
            controller: _passwordController,
            autofillHints: const [AutofillHints.password],
            enabled: !widget.isSubmitting,
            obscureText: _obscurePassword,
            autocorrect: false,
            enableSuggestions: false,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _handleSubmit(),
            decoration: InputDecoration(
              labelText: 'Contraseña',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                tooltip: _obscurePassword
                    ? 'Mostrar contraseña'
                    : 'Ocultar contraseña',
                icon: AnimatedSwitcher(
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 200),
                  transitionBuilder: (child, anim) =>
                      ScaleTransition(scale: anim, child: child),
                  child: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    key: ValueKey<bool>(_obscurePassword),
                  ),
                ),
                onPressed: () => setState(() {
                  _obscurePassword = !_obscurePassword;
                }),
              ),
            ),
          ),
          Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                  onPressed: widget.isSubmitting ? null : widget.onRecover,
                  child: const Text('Recuperar mi acceso'))),
          const SizedBox(height: 4),
          GradientActionButton(
            buttonKey: const ValueKey('login_submit_button'),
            label: 'Iniciar sesión',
            onPressed: _handleSubmit,
            busy: widget.isSubmitting,
            busyLabel: 'Iniciando sesión...',
          ),
        ],
      ),
    );
  }
}

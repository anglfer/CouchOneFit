import 'package:flutter/material.dart';

import '../../../shared/animations/shake_widget.dart';
import '../../../shared/widgets/gradient_widgets.dart';

class LoginForm extends StatefulWidget {
  const LoginForm({
    super.key,
    required this.isSubmitting,
    required this.onSubmit,
    this.errorMessage,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final Future<void> Function(String identifier, String password) onSubmit;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _identifierFocus = FocusNode();
  final _passwordFocus = FocusNode();

  bool _obscurePassword = true;
  bool _isIdentifierFocused = false;
  bool _isPasswordFocused = false;
  String? _validationError;

  @override
  void initState() {
    super.initState();
    _identifierFocus.addListener(_onFocusChange);
    _passwordFocus.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (mounted) {
      setState(() {
        _isIdentifierFocused = _identifierFocus.hasFocus;
        _isPasswordFocused = _passwordFocus.hasFocus;
      });
    }
  }

  @override
  void dispose() {
    _identifierFocus.removeListener(_onFocusChange);
    _passwordFocus.removeListener(_onFocusChange);
    _identifierFocus.dispose();
    _passwordFocus.dispose();
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
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final activeError = _validationError ?? widget.errorMessage;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: scheme.outlineVariant),
        boxShadow: [
          BoxShadow(
              color: scheme.onSurface.withValues(alpha: 0.025),
              blurRadius: 24,
              offset: const Offset(0, 8))
        ],
      ),
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (activeError != null) ...[
              ShakeWidget(
                triggerKey: activeError,
                child: Container(
                  key: const ValueKey('login_error_banner'),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: scheme.errorContainer,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: scheme.error.withValues(alpha: 0.8),
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: scheme.error.withValues(alpha: 0.15),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Semantics(
                    liveRegion: true,
                    child: Row(
                      children: [
                        Icon(
                          Icons.error_outline_rounded,
                          color: scheme.error,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            activeError,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: scheme.onErrorContainer,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Field 1: Identifier with interactive focus glow
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                boxShadow: _isIdentifierFocused
                    ? [
                        BoxShadow(
                          color: scheme.primary
                              .withValues(alpha: isDark ? 0.10 : 0.06),
                          blurRadius: 14,
                          spreadRadius: 0.5,
                        ),
                      ]
                    : [],
              ),
              child: TextField(
                key: const ValueKey('login_identifier_field'),
                controller: _identifierController,
                focusNode: _identifierFocus,
                autofillHints: const [AutofillHints.username],
                enabled: !widget.isSubmitting,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                decoration: InputDecoration(
                  fillColor: isDark
                      ? const Color(0xFF101C3D)
                      : const Color(0xFFF3F6FD),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                  labelText: 'Usuario o correo',
                  hintText: 'ejemplo@correo.com',
                  prefixIcon: Icon(
                    Icons.person_outline_rounded,
                    color: _isIdentifierFocused
                        ? scheme.primary
                        : scheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Field 2: Password with interactive focus glow
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                boxShadow: _isPasswordFocused
                    ? [
                        BoxShadow(
                          color: scheme.primary
                              .withValues(alpha: isDark ? 0.10 : 0.06),
                          blurRadius: 14,
                          spreadRadius: 0.5,
                        ),
                      ]
                    : [],
              ),
              child: TextField(
                key: const ValueKey('login_password_field'),
                controller: _passwordController,
                focusNode: _passwordFocus,
                autofillHints: const [AutofillHints.password],
                enabled: !widget.isSubmitting,
                obscureText: _obscurePassword,
                autocorrect: false,
                enableSuggestions: false,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _handleSubmit(),
                decoration: InputDecoration(
                  fillColor: isDark
                      ? const Color(0xFF101C3D)
                      : const Color(0xFFF3F6FD),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                  labelText: 'Contraseña',
                  prefixIcon: Icon(
                    Icons.lock_outline_rounded,
                    color: _isPasswordFocused
                        ? scheme.primary
                        : scheme.onSurfaceVariant,
                  ),
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
            ),
            const SizedBox(height: 22),

            GradientActionButton(
              buttonKey: const ValueKey('login_submit_button'),
              label: 'Iniciar sesión',
              onPressed: _handleSubmit,
              busy: widget.isSubmitting,
              busyLabel: 'Iniciando sesión...',
            ),
          ],
        ),
      ),
    );
  }
}

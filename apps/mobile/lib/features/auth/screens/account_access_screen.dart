import 'package:flutter/material.dart';
import '../models/session_models.dart';
import '../services/auth_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/gradient_widgets.dart';

enum AccountAccessMode { activation, credentials, recovery }

class AccountAccessScreen extends StatefulWidget {
  const AccountAccessScreen(
      {super.key, required this.mode, required this.authService});
  final AccountAccessMode mode;
  final AuthService authService;
  @override
  State<AccountAccessScreen> createState() => _AccountAccessScreenState();
}

class _AccountAccessScreenState extends State<AccountAccessScreen> {
  final _form = GlobalKey<FormState>();
  final _fields = <String, TextEditingController>{};
  bool _busy = false;
  bool _acceptsNotice = false;
  bool _passwordVisible = false;
  String? _error;
  String? _status;
  bool get _activation => widget.mode == AccountAccessMode.activation;
  bool get _credentials => widget.mode == AccountAccessMode.credentials;
  TextEditingController _controller(String field) =>
      _fields.putIfAbsent(field, TextEditingController.new);
  @override
  void dispose() {
    for (final controller in _fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    if (_activation && !_acceptsNotice) {
      setState(() => _error = 'Confirma la información de registro vigente.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _status = null;
    });
    final body = <String, Object?>{
      for (final entry in _fields.entries) entry.key: entry.value.text,
      if (_activation) 'noticeVersion': '2026-10-15.1',
      if (_activation) 'acceptsNotice': _acceptsNotice
    };
    try {
      var result = 'recovered';
      if (_activation) {
        final authenticated = await widget.authService.activate(body);
        result = authenticated ? 'activated' : 'requiresLogin';
      } else if (_credentials) {
        await widget.authService.changeCredentials(body);
        result = 'credentials';
      } else {
        await widget.authService.resetPassword(body);
      }
      for (final field in _fields.values) {
        field.clear();
      }
      if (mounted) Navigator.pop(context, result);
    } on AuthApiException catch (error) {
      if (mounted && _credentials && error.statusCode == 401) {
        Navigator.pop(context, 'sessionRequired');
        return;
      }
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() =>
            _error = 'No pudimos completar la solicitud. Revisa tu conexión.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkCode() async {
    final value = _controller('code').text;
    if (!RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(value)) {
      setState(() => _error = 'Escribe el código completo de 43 caracteres.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _status = null;
    });
    try {
      await widget.authService.prevalidate(value);
      if (mounted) {
        setState(() =>
            _status = 'El código está disponible. Comprobarlo no lo consume.');
      }
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos comprobar el código.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String name, String label,
      {bool secret = false, String? autofill, TextInputType? keyboard}) {
    final scheme = Theme.of(context).colorScheme;
    final icon = switch (name) {
      'code' => Icons.confirmation_number_outlined,
      'username' => Icons.person_outline_rounded,
      'email' || 'emailConfirmation' => Icons.alternate_email_rounded,
      _ => Icons.lock_outline_rounded,
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        key: Key('access-$name'),
        controller: _controller(name),
        enabled: !_busy,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          suffixIcon: secret
              ? IconButton(
                  tooltip: _passwordVisible
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña',
                  onPressed: () =>
                      setState(() => _passwordVisible = !_passwordVisible),
                  icon: Icon(_passwordVisible
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined),
                )
              : null,
          filled: true,
          fillColor: scheme.surface.withValues(alpha: 0.76),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: scheme.outlineVariant),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: scheme.outlineVariant),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: scheme.primary, width: 1.6),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: scheme.error),
          ),
        ),
        obscureText: secret && !_passwordVisible,
        autocorrect: false,
        enableSuggestions: !secret,
        textCapitalization: TextCapitalization.none,
        autofillHints: autofill == null ? null : [autofill],
        keyboardType: keyboard,
        validator: (value) {
          final text = value ?? '';
          if (text.isEmpty) return 'Completa este campo.';
          if (name == 'username' &&
              !RegExp(r'^[a-z0-9._]{3,30}$')
                  .hasMatch(text.trim().toLowerCase())) {
            return 'Usa entre 3 y 30 letras, números, puntos o guion bajo.';
          }
          if (name == 'password' &&
              (text.runes.length < 15 || text.runes.length > 128)) {
            return 'Usa de 15 a 128 caracteres. Los espacios cuentan.';
          }
          if (name == 'passwordConfirmation' &&
              text != _controller('password').text) {
            return 'Las contraseñas no coinciden.';
          }
          if (name == 'email' &&
              (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(text.trim()) ||
                  text.trim().length > 254)) {
            return 'Escribe un correo válido.';
          }
          if (name == 'emailConfirmation' &&
              text.trim().toLowerCase() !=
                  _controller('email').text.trim().toLowerCase()) {
            return 'Los correos no coinciden.';
          }
          if (name == 'code' &&
              !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(text)) {
            return 'Escribe el código completo de 43 caracteres.';
          }
          return null;
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = _activation
        ? 'Activar mi cuenta'
        : _credentials
            ? 'Cambiar mis credenciales'
            : 'Recuperar mi acceso';
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        appBar: AppBar(
            title: Text(title,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            scrolledUnderElevation: 0),
        body: DecoratedBox(
          decoration:
              BoxDecoration(color: Theme.of(context).scaffoldBackgroundColor),
          child: SafeArea(
            top: false,
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _AccessHeader(
                          activation: _activation,
                          credentials: _credentials,
                        ),
                        const SizedBox(height: 22),
                        Container(
                          padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .outlineVariant),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                _activation
                                    ? 'Invitación de tu profesional'
                                    : _credentials
                                        ? 'Protege tu cuenta'
                                        : 'Recupera tu acceso',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _activation
                                    ? 'Completa estos datos para abrir tu expediente preparado, sin volver a capturar tu información física.'
                                    : _credentials
                                        ? 'Confirma tu contraseña actual. Al guardar, se cerrarán tus otras sesiones.'
                                        : 'Solicita a tu profesional un código de recuperación válido por 30 minutos. Saber tu correo o usuario no basta para obtenerlo.',
                                style: TextStyle(
                                  height: 1.45,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                              ),
                              const SizedBox(height: 20),
                              if (!_credentials) ...[
                                _field(
                                  'code',
                                  _activation
                                      ? 'Código de invitación'
                                      : 'Código de recuperación',
                                ),
                                if (_activation)
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton.icon(
                                      onPressed: _busy ? null : _checkCode,
                                      icon: const Icon(Icons.verified_outlined),
                                      label: const Text('Comprobar código'),
                                    ),
                                  ),
                              ],
                              if (_activation || _credentials)
                                _field('username', 'Usuario',
                                    autofill: AutofillHints.username),
                              if (_activation) ...[
                                _field('email', 'Correo',
                                    autofill: AutofillHints.email,
                                    keyboard: TextInputType.emailAddress),
                                _field('emailConfirmation', 'Confirmar correo',
                                    keyboard: TextInputType.emailAddress),
                              ],
                              if (_credentials)
                                _field('currentPassword', 'Contraseña actual',
                                    secret: true,
                                    autofill: AutofillHints.password),
                              _field('password', 'Nueva contraseña',
                                  secret: true,
                                  autofill: AutofillHints.newPassword),
                              _field('passwordConfirmation',
                                  'Confirmar contraseña',
                                  secret: true,
                                  autofill: AutofillHints.newPassword),
                              Container(
                                padding: const EdgeInsets.all(13),
                                decoration: BoxDecoration(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .primary
                                      .withValues(alpha: 0.06),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.shield_outlined, size: 19),
                                    SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        'Usa de 15 a 128 caracteres. Los espacios cuentan.',
                                        style: TextStyle(height: 1.35),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_activation) ...[
                                const SizedBox(height: 16),
                                Container(
                                  padding: const EdgeInsets.all(15),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .primary
                                        .withValues(alpha: 0.055),
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary
                                          .withValues(alpha: 0.10),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(Icons.verified_user_outlined,
                                              size: 18),
                                          SizedBox(width: 8),
                                          Text('Información de registro',
                                              style: TextStyle(
                                                  fontWeight: FontWeight.w800)),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Versión 2026-10-15.1. Guardamos tus datos de cuenta para identificarte y gestionar tu acceso. Tu cuenta se vincula al expediente preparado por tu profesional. Esta confirmación no es una renuncia de derechos.',
                                        style: TextStyle(
                                          height: 1.4,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Material(
                                        color: Colors.transparent,
                                        child: CheckboxListTile(
                                          contentPadding: EdgeInsets.zero,
                                          controlAffinity:
                                              ListTileControlAffinity.leading,
                                          value: _acceptsNotice,
                                          onChanged: _busy
                                              ? null
                                              : (value) => setState(() =>
                                                  _acceptsNotice =
                                                      value ?? false),
                                          title: const Text(
                                            'Leí y confirmo esta información',
                                            style: TextStyle(fontSize: 13),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              if (_error != null) ...[
                                const SizedBox(height: 12),
                                Semantics(
                                  liveRegion: true,
                                  child: Text(
                                    _error!,
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .error),
                                  ),
                                ),
                              ],
                              if (_status != null) ...[
                                const SizedBox(height: 12),
                                Semantics(
                                  liveRegion: true,
                                  child: Text(
                                    _status!,
                                    style: TextStyle(
                                      color:
                                          Theme.of(context).colorScheme.primary,
                                    ),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 18),
                              GradientActionButton(
                                label: _activation
                                    ? 'Activar mi cuenta'
                                    : 'Guardar cambios',
                                onPressed: _submit,
                                busy: _busy,
                                busyLabel: 'Procesando…',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AccessHeader extends StatelessWidget {
  const _AccessHeader({required this.activation, required this.credentials});

  final bool activation;
  final bool credentials;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final title = activation
        ? 'Tu espacio de bienestar empieza aquí'
        : credentials
            ? 'Mantén segura tu cuenta'
            : 'Volvamos a conectarte';
    final subtitle = activation
        ? 'Unos pasos sencillos para continuar con tu profesional.'
        : credentials
            ? 'Actualiza tus datos de acceso con tranquilidad.'
            : 'Recupera el acceso a tu expediente de forma segura.';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: BrandColors.gradient,
            boxShadow: [
              BoxShadow(
                color: scheme.primary.withValues(alpha: 0.24),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Icon(
            activation
                ? Icons.favorite_rounded
                : credentials
                    ? Icons.lock_reset_rounded
                    : Icons.key_rounded,
            color: Colors.white,
            size: 28,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      height: 1.08,
                      letterSpacing: -0.5,
                    ),
              ),
              const SizedBox(height: 5),
              Text(
                subtitle,
                style: TextStyle(
                  color: scheme.onSurfaceVariant,
                  height: 1.35,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

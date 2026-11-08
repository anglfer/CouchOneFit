import 'package:flutter/material.dart';
import '../models/session_models.dart';
import '../services/auth_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/detail_scaffold.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/section_title.dart';

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
  // Where the latest message came from: shown next to the code check, else by submit.
  bool _fromCodeCheck = false;
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
      setState(() {
        _fromCodeCheck = false;
        _status = null;
        _error = 'Confirma la información de registro vigente.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _status = null;
      _fromCodeCheck = false;
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
      setState(() {
        _fromCodeCheck = true;
        _status = null;
        _error = 'Escribe el código completo de 43 caracteres.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _status = null;
      _fromCodeCheck = true;
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

  List<Widget> _messages() => [
        if (_error != null)
          NoticeBanner(
              text: _error!,
              tone: NoticeTone.error,
              margin: const EdgeInsets.only(top: 12)),
        if (_status != null)
          NoticeBanner(
              text: _status!,
              tone: NoticeTone.success,
              margin: const EdgeInsets.only(top: 12)),
      ];

  Widget _field(String name, String label,
      {bool secret = false, String? autofill, TextInputType? keyboard}) {
    final icon = switch (name) {
      'code' => Icons.confirmation_number_outlined,
      'username' => Icons.person_outline_rounded,
      'email' || 'emailConfirmation' => Icons.alternate_email_rounded,
      _ => Icons.lock_outline_rounded,
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
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
    final colors = Theme.of(context).colorScheme;
    final title = _activation
        ? 'Activar mi cuenta'
        : _credentials
            ? 'Cambiar mis credenciales'
            : 'Recuperar mi acceso';
    final heading = _activation
        ? 'Tu espacio de bienestar empieza aquí'
        : _credentials
            ? 'Mantén segura tu cuenta'
            : 'Volvamos a conectarte';
    final explanation = _activation
        ? 'Completa estos datos para abrir tu expediente preparado, sin volver a capturar tu información física.'
        : _credentials
            ? 'Confirma tu contraseña actual. Al guardar, se cerrarán tus otras sesiones.'
            : 'Solicita a tu profesional un código de recuperación válido por 30 minutos. Saber tu correo o usuario no basta para obtenerlo.';
    Widget section(String text) => Padding(
        padding: const EdgeInsets.only(top: 10, bottom: 12),
        child: SectionTitle(text));
    return PopScope(
      canPop: !_busy,
      child: DetailScaffold(
        title: Text(title, style: const TextStyle(fontSize: 16)),
        maxWidth: 440,
        children: [
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                    header: true,
                    child: Text(heading,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(fontSize: 28, height: 1.12))),
                const SizedBox(height: 10),
                Text(explanation,
                    style: TextStyle(
                        fontSize: 15,
                        height: 1.45,
                        color: colors.onSurfaceVariant)),
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
                  if (_fromCodeCheck) ...[
                    ..._messages(),
                    const SizedBox(height: 16),
                  ],
                ],
                if (_activation || _credentials) ...[
                  section('Tu cuenta'),
                  _field('username', 'Usuario',
                      autofill: AutofillHints.username),
                ],
                if (_activation) ...[
                  _field('email', 'Correo',
                      autofill: AutofillHints.email,
                      keyboard: TextInputType.emailAddress),
                  _field('emailConfirmation', 'Confirmar correo',
                      keyboard: TextInputType.emailAddress),
                ],
                section('Tu contraseña'),
                if (_credentials)
                  _field('currentPassword', 'Contraseña actual',
                      secret: true, autofill: AutofillHints.password),
                _field('password', 'Nueva contraseña',
                    secret: true, autofill: AutofillHints.newPassword),
                _field('passwordConfirmation', 'Confirmar contraseña',
                    secret: true, autofill: AutofillHints.newPassword),
                _PasswordLength(controller: _controller('password')),
                if (_activation) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                    decoration: innerPanelDecoration(context),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Información de registro',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        Text(
                          'Versión 2026-10-15.1. Guardamos tus datos de cuenta para identificarte y gestionar tu acceso. Tu cuenta se vincula al expediente preparado por tu profesional. Esta confirmación no es una renuncia de derechos.',
                          style: TextStyle(
                            fontSize: 13.5,
                            height: 1.4,
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                        Material(
                          color: Colors.transparent,
                          child: CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                            value: _acceptsNotice,
                            onChanged: _busy
                                ? null
                                : (value) => setState(
                                    () => _acceptsNotice = value ?? false),
                            title: const Text(
                              'Leí y confirmo esta información',
                              style: TextStyle(fontSize: 14),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (!_fromCodeCheck) ..._messages(),
                const SizedBox(height: 20),
                GradientActionButton(
                  label: _activation ? 'Activar mi cuenta' : 'Guardar cambios',
                  onPressed: _submit,
                  busy: _busy,
                  busyLabel: 'Procesando…',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Live length check, so the 15-character rule shows before submitting.
class _PasswordLength extends StatelessWidget {
  const _PasswordLength({required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (context, value, _) {
          final length = value.text.runes.length;
          final valid = length >= 15 && length <= 128;
          final tone = valid ? BrandColors.success : colors.secondary;
          return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                        minHeight: 4,
                        value: (length / 15).clamp(0, 1).toDouble(),
                        color: tone)),
                const SizedBox(height: 8),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(
                      valid
                          ? Icons.check_circle_rounded
                          : Icons.shield_outlined,
                      size: 17,
                      color: statusInk(context, tone)),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Text(
                          'Usa de 15 a 128 caracteres. Los espacios cuentan.',
                          style: TextStyle(
                              fontSize: 13,
                              height: 1.35,
                              color: colors.onSurfaceVariant))),
                  if (length > 0) ...[
                    const SizedBox(width: 8),
                    Text('$length',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            fontFeatures: const [FontFeature.tabularFigures()],
                            color: colors.onSurfaceVariant)),
                  ],
                ]),
              ]);
        });
  }
}

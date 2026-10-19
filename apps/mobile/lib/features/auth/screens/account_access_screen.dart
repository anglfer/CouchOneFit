import 'package:flutter/material.dart';
import '../models/session_models.dart';
import '../services/auth_service.dart';

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
    return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextFormField(
          key: Key('access-$name'),
          controller: _controller(name),
          enabled: !_busy,
          decoration: InputDecoration(
              labelText: label, border: const OutlineInputBorder()),
          obscureText: secret,
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
        ));
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
            appBar: AppBar(title: Text(title)),
            body: SafeArea(
                child: Center(
                    child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Form(
                      key: _form,
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(_activation
                                ? 'Usa la invitación de tu profesional para acceder a tu expediente preparado, sin recapturar tus datos físicos.'
                                : _credentials
                                    ? 'Confirma tu contraseña actual. Al guardar se cerrarán todas tus sesiones y tendrás que entrar con tus nuevas credenciales.'
                                    : 'En otro dispositivo puedes entrar con tus credenciales habituales y conservar tu expediente. Si olvidaste tu contraseña, contacta a tu profesional. Tras corroborar tu identidad por la relación conocida, te entregará un código válido por 30 minutos. Saber tu correo o usuario no basta.'),
                            const SizedBox(height: 20),
                            if (!_credentials)
                              _field(
                                  'code',
                                  _activation
                                      ? 'Código de invitación'
                                      : 'Código de recuperación'),
                            if (_activation)
                              TextButton(
                                  onPressed: _busy ? null : _checkCode,
                                  child: const Text(
                                      'Comprobar código sin consumirlo')),
                            if (_activation || _credentials)
                              _field('username', 'Usuario',
                                  autofill: AutofillHints.username),
                            if (_activation)
                              _field('email', 'Correo',
                                  autofill: AutofillHints.email,
                                  keyboard: TextInputType.emailAddress),
                            if (_activation)
                              _field('emailConfirmation', 'Confirmar correo',
                                  keyboard: TextInputType.emailAddress),
                            if (_credentials)
                              _field('currentPassword', 'Contraseña actual',
                                  secret: true,
                                  autofill: AutofillHints.password),
                            _field('password', 'Nueva contraseña',
                                secret: true,
                                autofill: AutofillHints.newPassword),
                            _field(
                                'passwordConfirmation', 'Confirmar contraseña',
                                secret: true,
                                autofill: AutofillHints.newPassword),
                            const Text(
                                'La contraseña debe tener de 15 a 128 caracteres. Los espacios cuentan.'),
                            if (_activation) ...[
                              const SizedBox(height: 16),
                              const Text(
                                  'Información de registro · versión 2026-10-15.1. Guardamos tus datos de cuenta para identificarte y gestionar tu acceso a CouchOne Fit. Tu cuenta se vincula al expediente preparado por tu profesional. Esta confirmación informativa no es una renuncia de derechos.'),
                              CheckboxListTile(
                                  value: _acceptsNotice,
                                  onChanged: _busy
                                      ? null
                                      : (value) => setState(() =>
                                          _acceptsNotice = value ?? false),
                                  title: const Text(
                                      'He leído y confirmo la información de registro')),
                            ],
                            if (_error != null)
                              Semantics(
                                  liveRegion: true,
                                  child: Text(_error!,
                                      style: TextStyle(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .error))),
                            if (_status != null)
                              Semantics(
                                  liveRegion: true, child: Text(_status!)),
                            const SizedBox(height: 16),
                            FilledButton(
                                onPressed: _busy ? null : _submit,
                                child: Text(_busy
                                    ? 'Procesando…'
                                    : _activation
                                        ? 'Activar cuenta'
                                        : 'Guardar credenciales')),
                          ]))),
            )))));
  }
}

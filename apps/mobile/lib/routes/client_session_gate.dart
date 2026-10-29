import 'package:flutter/material.dart';
import '../shared/animations/premium_route.dart';

import '../features/auth/models/session_models.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/auth/screens/account_access_screen.dart';
import '../features/auth/screens/welcome_screen.dart';
import '../features/auth/services/auth_service.dart';
import '../features/client/models/client_profile.dart';
import '../features/client/screens/client_profile_screen.dart';
import '../features/client/services/client_profile_service.dart';

class ClientSessionGate extends StatefulWidget {
  const ClientSessionGate({
    super.key,
    required this.onThemeChanged,
    required this.authService,
    required this.profileService,
  });

  final ValueChanged<ThemeMode> onThemeChanged;
  final AuthService authService;
  final ClientProfileService profileService;

  @override
  State<ClientSessionGate> createState() => _ClientSessionGateState();
}

class _ClientSessionGateState extends State<ClientSessionGate> {
  ClientProfile? _profile;
  bool _loadingProfile = true;
  bool _hasSession = false;
  bool _queryFailed = false;
  String? _expectedClientId;
  int _epoch = 0;
  bool _isSubmitting = false;
  bool _isRefreshing = false;
  bool _showWelcome = true;
  String? _errorMessage;
  String? _statusMessage;

  Future<void> _openAccess(AccountAccessMode mode) async {
    final result = await Navigator.push<String>(
        context,
        premiumRoute((_) =>
            AccountAccessScreen(mode: mode, authService: widget.authService)));
    if (!mounted || result == null) return;
    if (result == 'activated') {
      await _restoreSession();
    } else {
      setState(() {
        ++_epoch;
        _hasSession = false;
        _expectedClientId = null;
        _queryFailed = false;
        _profile = null;
        if (result == 'requiresLogin') _showWelcome = false;
        _errorMessage = null;
        _statusMessage = result == 'sessionRequired'
            ? 'Tu sesión venció. Inicia sesión de nuevo.'
            : result == 'requiresLogin'
                ? 'Tu cuenta está activada. Inicia sesión con tus credenciales.'
                : 'Credenciales actualizadas. Inicia sesión de nuevo. Todas tus sesiones anteriores se cerraron.';
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  bool _definitive(AuthApiException error) =>
      error.statusCode == 401 ||
      (error.statusCode == 403 && error.code == 'ROLE_FORBIDDEN');

  Future<void> _loadProfile({bool validateSession = true}) async {
    final epoch = ++_epoch;
    setState(() {
      _loadingProfile = true;
      _queryFailed = false;
      _errorMessage = null;
    });
    try {
      // The endpoint revalidates the session on every read; restoration also
      // resolves its subject before obtaining the initial record.
      final account =
          validateSession ? await widget.authService.restoreSession() : null;
      if (!mounted || epoch != _epoch) return;
      if (validateSession && account == null) {
        setState(() {
          _hasSession = false;
          _profile = null;
          _expectedClientId = null;
        });
        return;
      }
      if (account != null) {
        if (_expectedClientId != account.clientId) _profile = null;
        _expectedClientId = account.clientId;
      }
      _hasSession = true;
      final profile = await widget.profileService.fetchProfile();
      if (!mounted || epoch != _epoch) return;
      if (profile.id != _expectedClientId) {
        throw const AuthApiException(
            statusCode: 503,
            code: 'INVALID_RESPONSE',
            message: 'No pudimos consultar tu expediente. Inténtalo de nuevo.');
      }
      setState(() {
        _profile = profile;
        _queryFailed = false;
      });
    } on AuthApiException catch (error) {
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _profile = null;
        if (_definitive(error)) {
          _hasSession = false;
          _expectedClientId = null;
          _showWelcome = false;
        } else {
          _queryFailed = true;
        }
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _profile = null;
        _queryFailed = true;
        _errorMessage =
            'No pudimos consultar tu expediente. Revisa tu conexión e inténtalo de nuevo.';
      });
    } finally {
      if (mounted && epoch == _epoch) {
        setState(() {
          _loadingProfile = false;
          _isRefreshing = false;
        });
      }
    }
  }

  Future<void> _restoreSession() => _loadProfile();

  Future<void> _handleLogin(String identifier, String password) async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
      _statusMessage = null;
    });
    try {
      final account = await widget.authService
          .login(identifier: identifier, password: password);
      if (!mounted) return;
      setState(() {
        _profile = null;
        _expectedClientId = account.clientId;
        _hasSession = true;
        _showWelcome = false;
      });
      await _loadProfile(validateSession: false);
    } on AuthApiException catch (error) {
      if (mounted) {
        setState(() {
          _profile = null;
          _hasSession = false;
          _errorMessage = error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _profile = null;
          _hasSession = false;
          _errorMessage = 'No pudimos completar la solicitud.';
        });
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _handleRefreshProfile() => _loadProfile(validateSession: false);

  Future<void> _handleLogout() async {
    ++_epoch;
    setState(() {
      _loadingProfile = true;
      _isRefreshing = true;
    });
    try {
      await widget.authService.logout();
      if (!mounted) return;
      setState(() {
        _profile = null;
        _hasSession = false;
        _expectedClientId = null;
        _queryFailed = false;
        _loadingProfile = false;
        _isRefreshing = false;
        _errorMessage = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingProfile = false;
          _isRefreshing = false;
          _queryFailed = false;
          _errorMessage =
              'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeProfile = _profile;

    return Scaffold(
      appBar: AppBar(
        title: activeProfile == null
            ? null
            : const Text('CouchOne Fit',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        leading: activeProfile == null && !_showWelcome
            ? IconButton(
                tooltip: 'Volver',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => setState(() {
                  _showWelcome = true;
                  _errorMessage = null;
                  _statusMessage = null;
                }),
              )
            : null,
        backgroundColor: activeProfile == null
            ? Theme.of(context).scaffoldBackgroundColor
            : null,
        scrolledUnderElevation: activeProfile == null ? 0 : null,
        actions: [
          Builder(builder: (context) {
            final dark = Theme.of(context).brightness == Brightness.dark;
            return IconButton(
              tooltip: dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
              icon: AnimatedSwitcher(
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 220),
                  transitionBuilder: (child, animation) => RotationTransition(
                      turns: Tween<double>(begin: -0.125, end: 0)
                          .animate(animation),
                      child: FadeTransition(opacity: animation, child: child)),
                  child: Icon(
                      dark
                          ? Icons.light_mode_outlined
                          : Icons.dark_mode_outlined,
                      key: ValueKey(dark))),
              onPressed: () => widget.onThemeChanged(
                dark ? ThemeMode.light : ThemeMode.dark,
              ),
            );
          }),
        ],
      ),
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: _loadingProfile ||
                  _queryFailed ||
                  activeProfile == null ||
                  MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : const Duration(milliseconds: 320),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          layoutBuilder: (current, previous) => Stack(
            fit: StackFit.expand,
            children: [
              for (final child in previous)
                ExcludeSemantics(child: IgnorePointer(child: child)),
              if (current != null) current,
            ],
          ),
          transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SlideTransition(
                  position: Tween<Offset>(
                          begin: const Offset(0, 0.025), end: Offset.zero)
                      .animate(animation),
                  child: child)),
          child: _loadingProfile
              ? Center(
                  key: const ValueKey('record-loading'),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const CircularProgressIndicator(),
                    Text(_isRefreshing
                        ? 'Cerrando sesión…'
                        : 'Consultando tu expediente…')
                  ]))
              : _queryFailed
                  ? Center(
                      key: const ValueKey('record-query-error'),
                      child: Padding(
                          padding: const EdgeInsets.all(24),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            Semantics(
                                liveRegion: true,
                                child: Text(_errorMessage ??
                                    'No pudimos consultar tu expediente.')),
                            TextButton(
                                onPressed: () => _loadProfile(),
                                child: const Text('Reintentar consulta')),
                            if (_hasSession)
                              TextButton(
                                  onPressed: _handleLogout,
                                  child: const Text('Cerrar sesión')),
                          ])))
                  : activeProfile == null
                      ? _showWelcome &&
                              _errorMessage == null &&
                              _statusMessage == null
                          ? WelcomeScreen(
                              key: const ValueKey('welcome-screen'),
                              onLogin: () =>
                                  setState(() => _showWelcome = false),
                              onActivate: () =>
                                  _openAccess(AccountAccessMode.activation),
                            )
                          : LoginScreen(
                              key: const ValueKey('login-screen'),
                              isSubmitting: _isSubmitting,
                              errorMessage: _errorMessage,
                              statusMessage: _statusMessage,
                              onSubmit: _handleLogin,
                              onActivate: () =>
                                  _openAccess(AccountAccessMode.activation),
                              onRecover: () =>
                                  _openAccess(AccountAccessMode.recovery),
                            )
                      : ClientProfileScreen(
                          key: const ValueKey('profile-screen'),
                          profile: activeProfile,
                          isRefreshing: _isRefreshing,
                          errorMessage: _errorMessage,
                          onRefresh: _handleRefreshProfile,
                          onLogout: _handleLogout,
                          onCredentials: () =>
                              _openAccess(AccountAccessMode.credentials),
                        ),
        ),
      ),
    );
  }
}

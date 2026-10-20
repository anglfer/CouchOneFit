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

  Future<void> _restoreSession() async {
    try {
      final restored = await widget.authService.restoreSession();
      if (restored == null) return;
      final profile = await widget.profileService.fetchProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _errorMessage = null;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _profile = null;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _profile = null;
      });
    }
  }

  Future<void> _handleLogin(String identifier, String password) async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
      _statusMessage = null;
    });
    try {
      await widget.authService.login(
        identifier: identifier,
        password: password,
      );
      final profile = await widget.profileService.fetchProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _isSubmitting = false;
        _showWelcome = false;
        _errorMessage = null;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _profile = null;
        _isSubmitting = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _profile = null;
        _isSubmitting = false;
        _errorMessage = 'No pudimos completar la solicitud.';
      });
    }
  }

  Future<void> _handleRefreshProfile() async {
    setState(() {
      _isRefreshing = true;
      _errorMessage = null;
    });
    try {
      final profile = await widget.profileService.fetchProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _isRefreshing = false;
        _errorMessage = null;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        if (error.statusCode == 401 || error.statusCode == 403) {
          _profile = null;
        }
        _isRefreshing = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isRefreshing = false;
        _errorMessage = 'No pudimos completar la solicitud.';
      });
    }
  }

  Future<void> _handleLogout() async {
    setState(() {
      _isRefreshing = true;
      _errorMessage = null;
    });
    try {
      await widget.authService.logout();
      if (!mounted) return;
      setState(() {
        _profile = null;
        _isRefreshing = false;
        _errorMessage = null;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _isRefreshing = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isRefreshing = false;
        _errorMessage =
            'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.';
      });
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
          duration: MediaQuery.disableAnimationsOf(context)
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
          child: activeProfile == null
              ? _showWelcome && _errorMessage == null && _statusMessage == null
                  ? WelcomeScreen(
                      key: const ValueKey('welcome-screen'),
                      onLogin: () => setState(() => _showWelcome = false),
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
                      onRecover: () => _openAccess(AccountAccessMode.recovery),
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

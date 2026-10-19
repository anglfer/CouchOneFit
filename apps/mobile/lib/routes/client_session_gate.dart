import 'package:flutter/material.dart';

import '../features/auth/models/session_models.dart';
import '../features/auth/screens/login_screen.dart';
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
  String? _errorMessage;

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
        actions: [
          Builder(builder: (context) {
            final dark = Theme.of(context).brightness == Brightness.dark;
            return IconButton(
              tooltip: dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
              icon: Icon(
                  dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
              onPressed: () => widget.onThemeChanged(
                dark ? ThemeMode.light : ThemeMode.dark,
              ),
            );
          }),
        ],
      ),
      body: SafeArea(
        child: activeProfile == null
            ? LoginScreen(
                isSubmitting: _isSubmitting,
                errorMessage: _errorMessage,
                onSubmit: _handleLogin,
              )
            : ClientProfileScreen(
                profile: activeProfile,
                isRefreshing: _isRefreshing,
                errorMessage: _errorMessage,
                onRefresh: _handleRefreshProfile,
                onLogout: _handleLogout,
              ),
      ),
    );
  }
}

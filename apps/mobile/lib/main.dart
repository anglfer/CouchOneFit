import 'package:flutter/material.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/services/session_storage.dart';
import 'features/client/services/client_profile_service.dart';
import 'routes/client_session_gate.dart';
import 'shared/services/api_client.dart';
import 'shared/services/api_config.dart';
import 'shared/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiConfig.load();
  runApp(const CouchOneFitApp());
}

class CouchOneFitApp extends StatefulWidget {
  const CouchOneFitApp({
    super.key,
    this.sessionStorage,
    this.apiClient,
    this.authService,
    this.profileService,
  });

  final SessionStorage? sessionStorage;
  final ApiClient? apiClient;
  final AuthService? authService;
  final ClientProfileService? profileService;

  @override
  State<CouchOneFitApp> createState() => _CouchOneFitAppState();
}

class _CouchOneFitAppState extends State<CouchOneFitApp> {
  // shortcut: la elección dura esta sesión; persistir al incorporar ajustes locales.
  ThemeMode _themeMode = ThemeMode.system;
  late final SessionStorage _sessionStorage;
  late final ApiClient _apiClient;
  late final AuthService _authService;
  late final ClientProfileService _profileService;

  @override
  void initState() {
    super.initState();
    _sessionStorage = widget.sessionStorage ?? MethodChannelSessionStorage();
    _apiClient = widget.apiClient ?? ApiClient(sessionStorage: _sessionStorage);
    _authService = widget.authService ??
        AuthService(apiClient: _apiClient, sessionStorage: _sessionStorage);
    _profileService =
        widget.profileService ?? ClientProfileService(apiClient: _apiClient);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CouchOne Fit',
      debugShowCheckedModeBanner: false,
      theme: mobileTheme(Brightness.light),
      darkTheme: mobileTheme(Brightness.dark),
      themeMode: _themeMode,
      home: ClientSessionGate(
        authService: _authService,
        profileService: _profileService,
        onThemeChanged: (themeMode) => setState(() {
          _themeMode = themeMode;
        }),
      ),
    );
  }
}

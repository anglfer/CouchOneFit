import 'package:flutter/material.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/services/session_storage.dart';
import 'features/client/services/client_profile_service.dart';
import 'routes/client_session_gate.dart';
import 'shared/services/api_client.dart';
import 'shared/services/api_config.dart';
import 'shared/theme/app_theme.dart';
import 'features/training/services/training_service.dart';
import 'features/settings/models/app_settings.dart';
import 'features/settings/services/settings_controller.dart';

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
  final _settings = SettingsController();
  late final SessionStorage _sessionStorage;
  late final ApiClient _apiClient;
  late final AuthService _authService;
  late final ClientProfileService _profileService;
  late final TrainingService _trainingService;

  @override
  void initState() {
    super.initState();
    _sessionStorage = widget.sessionStorage ?? MethodChannelSessionStorage();
    _apiClient = widget.apiClient ?? ApiClient(sessionStorage: _sessionStorage);
    _authService = widget.authService ??
        AuthService(apiClient: _apiClient, sessionStorage: _sessionStorage);
    _trainingService = TrainingService(apiClient: _apiClient);
    _profileService =
        widget.profileService ?? ClientProfileService(apiClient: _apiClient);
    _settings.load();
  }

  @override
  void dispose() {
    _settings.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AppSettings>(
        valueListenable: _settings,
        builder: (context, settings, _) => MaterialApp(
              title: 'CouchOne Fit',
              debugShowCheckedModeBanner: false,
              theme: mobileTheme(Brightness.light),
              darkTheme: mobileTheme(Brightness.dark),
              themeMode: settings.themeMode,
              home: ClientSessionGate(
                authService: _authService,
                profileService: _profileService,
                trainingService: _trainingService,
                settings: _settings,
                onThemeChanged: (themeMode) =>
                    _settings.update(settings.copyWith(themeMode: themeMode)),
              ),
            ));
  }
}

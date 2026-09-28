import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String _prodUrl = 'https://couchonefit-api.onrender.com';
  // En desarrollo local (Windows/Web es localhost; en emulador Android se suele usar 10.0.2.2)
  static const String _devUrl = 'http://localhost:3000';

  static String get baseUrl => kReleaseMode ? _prodUrl : _devUrl;
  static String get healthEndpoint => '$baseUrl/api/health';
}

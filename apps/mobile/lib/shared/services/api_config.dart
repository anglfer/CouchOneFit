import 'dart:convert';

import 'package:flutter/services.dart';

class ApiConfig {
  static const _override = String.fromEnvironment('API_BASE_URL');
  static String _baseUrl =
      _override.isEmpty ? 'http://10.0.2.2:3000' : _override;

  static String get baseUrl => _baseUrl;
  static String get healthEndpoint => '$baseUrl/api/health';

  static Future<void> load({AssetBundle? bundle}) async {
    Object? value = _override;
    if (_override.isEmpty) {
      final environment =
          jsonDecode(await (bundle ?? rootBundle).loadString('.env.json'));
      value = environment is Map ? environment['API_BASE_URL'] : null;
    }
    final url = value is String ? value.trim() : '';
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw const FormatException(
        'Configura API_BASE_URL con una URL HTTP o HTTPS válida en .env.json.',
      );
    }
    _baseUrl = url.replaceFirst(RegExp(r'/+$'), '');
  }
}

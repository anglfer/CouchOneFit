import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

/// Devuelve verdadero si se está ejecutando en el entorno de pruebas de Flutter.
/// Permite que las animaciones infinitas o ambientales no bloqueen `pumpAndSettle`.
bool get isTestEnvironment {
  if (kIsWeb) return false;
  try {
    return Platform.environment.containsKey('FLUTTER_TEST');
  } catch (_) {
    return false;
  }
}

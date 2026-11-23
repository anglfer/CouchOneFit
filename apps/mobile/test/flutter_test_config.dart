import 'dart:async';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    final entries = <String, String>{};
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('couchonefit/secure_session'), (call) async {
      final args = Map<String, Object?>.from(call.arguments as Map);
      final key = args['key'] as String;
      if (call.method == 'write') entries[key] = args['value'] as String;
      if (call.method == 'delete') entries.remove(key);
      return call.method == 'read' ? entries[key] : null;
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('couchonefit/notifications'), (call) async {
      if (call.method == 'requestPermission' || call.method == 'areEnabled') {
        return true;
      }
      return null;
    });
  });
  await testMain();
}

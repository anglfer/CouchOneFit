import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/session_models.dart';

abstract interface class SessionStorage {
  Future<StoredSession?> readSession();
  Future<void> saveSession(StoredSession session);
  Future<void> clearSession();
}

class InMemorySessionStorage implements SessionStorage {
  InMemorySessionStorage({StoredSession? initialSession}) {
    if (initialSession != null) {
      _entries[_sessionKey] = jsonEncode(initialSession.toJson());
    }
  }

  static const String _sessionKey = 'cof_client_session';
  final Map<String, String> _entries = <String, String>{};

  Map<String, String> get rawEntries => Map<String, String>.unmodifiable(_entries);

  @override
  Future<StoredSession?> readSession() async {
    final raw = _entries[_sessionKey];
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        _entries.remove(_sessionKey);
        return null;
      }
      return StoredSession.fromJson(Map<String, Object?>.from(decoded));
    } catch (_) {
      _entries.remove(_sessionKey);
      return null;
    }
  }

  @override
  Future<void> saveSession(StoredSession session) async {
    final payload = <String, Object?>{
      'accessToken': session.accessToken,
      'refreshToken': session.refreshToken,
      'expiresAt': session.expiresAt.toUtc().toIso8601String(),
    };
    _entries[_sessionKey] = jsonEncode(payload);
  }

  @override
  Future<void> clearSession() async {
    _entries.remove(_sessionKey);
  }
}

class MethodChannelSessionStorage implements SessionStorage {
  MethodChannelSessionStorage({
    MethodChannel? channel,
    InMemorySessionStorage? fallback,
  })  : _channel = channel ?? const MethodChannel('couchonefit/secure_session'),
        _fallback = fallback ?? InMemorySessionStorage();

  static const String _sessionKey = 'cof_client_session';
  final MethodChannel _channel;
  final InMemorySessionStorage _fallback;

  @override
  Future<StoredSession?> readSession() async {
    try {
      final raw = await _channel.invokeMethod<String>(
        'read',
        const <String, Object?>{'key': _sessionKey},
      );
      if (raw == null || raw.isEmpty) return await _fallback.readSession();
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        await clearSession();
        return null;
      }
      return StoredSession.fromJson(Map<String, Object?>.from(decoded));
    } on MissingPluginException {
      return _fallback.readSession();
    } on PlatformException {
      return _fallback.readSession();
    } catch (_) {
      await clearSession();
      return null;
    }
  }

  @override
  Future<void> saveSession(StoredSession session) async {
    final sanitized = StoredSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    );
    await _fallback.saveSession(sanitized);
    try {
      await _channel.invokeMethod<void>(
        'write',
        <String, Object?>{
          'key': _sessionKey,
          'value': jsonEncode(sanitized.toJson()),
        },
      );
    } on MissingPluginException {
      // Uses in-memory fallback when native keystore channel is not registered.
    } on PlatformException {
      // Keeps in-memory fallback for current runtime session.
    }
  }

  @override
  Future<void> clearSession() async {
    await _fallback.clearSession();
    try {
      await _channel.invokeMethod<void>(
        'delete',
        const <String, Object?>{'key': _sessionKey},
      );
    } on MissingPluginException {
      // Ignored when native keystore channel is not registered.
    } on PlatformException {
      // Ignored when native keystore channel fails.
    }
  }
}

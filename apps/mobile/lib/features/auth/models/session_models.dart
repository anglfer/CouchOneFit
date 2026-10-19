class ClientAccount {
  const ClientAccount({
    required this.id,
    required this.clientId,
    required this.username,
    required this.email,
    required this.fullName,
    required this.role,
    required this.status,
    required this.clientStatus,
  });

  final String id;
  final String clientId;
  final String username;
  final String email;
  final String fullName;
  final String role;
  final String status;
  final String clientStatus;

  factory ClientAccount.fromJson(Map<String, Object?> json) {
    return ClientAccount(
      id: (json['id'] as String?) ?? '',
      clientId: (json['clientId'] as String?) ?? '',
      username: (json['username'] as String?) ?? '',
      email: (json['email'] as String?) ?? '',
      fullName: (json['fullName'] as String?) ?? '',
      role: (json['role'] as String?) ?? '',
      status: (json['status'] as String?) ?? '',
      clientStatus: (json['clientStatus'] as String?) ?? '',
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'clientId': clientId,
        'username': username,
        'email': email,
        'fullName': fullName,
        'role': role,
        'status': status,
        'clientStatus': clientStatus,
      };
}

class StoredSession {
  const StoredSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;

  factory StoredSession.fromJson(Map<String, Object?> json) {
    final rawAccess = json['accessToken'];
    final rawRefresh = json['refreshToken'];
    final rawExpires = json['expiresAt'];
    if (rawAccess is! String ||
        rawAccess.isEmpty ||
        rawRefresh is! String ||
        rawRefresh.isEmpty ||
        rawExpires is! String) {
      throw const FormatException('Invalid stored session payload');
    }
    return StoredSession(
      accessToken: rawAccess,
      refreshToken: rawRefresh,
      expiresAt: DateTime.parse(rawExpires),
    );
  }

  Map<String, Object?> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresAt': expiresAt.toUtc().toIso8601String(),
      };
}

class ClientLoginResult {
  const ClientLoginResult({
    required this.account,
    required this.session,
  });

  final ClientAccount account;
  final StoredSession session;
}

class AuthApiException implements Exception {
  const AuthApiException({
    required this.statusCode,
    required this.code,
    required this.message,
  });

  final int statusCode;
  final String code;
  final String message;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;

  @override
  String toString() => 'AuthApiException($statusCode, $code): $message';
}


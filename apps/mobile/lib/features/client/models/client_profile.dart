class ClientProfile {
  const ClientProfile({
    required this.id,
    required this.userId,
    required this.professionalId,
    required this.fullName,
    required this.goal,
    required this.status,
    required this.username,
    required this.email,
    this.birthDate,
    this.heightCm,
    this.baseWeightKg,
    this.baseBodyFatPercentage,
    this.waistCm,
    this.hipCm,
  });

  final String id;
  final String userId;
  final String professionalId;
  final String fullName;
  final String? goal;
  final String status;
  final String username;
  final String email;
  final String? birthDate;
  final double? heightCm;
  final double? baseWeightKg;
  final double? baseBodyFatPercentage;
  final double? waistCm;
  final double? hipCm;

  factory ClientProfile.fromJson(Map<String, Object?> json) {
    return ClientProfile(
      id: (json['id'] as String?) ?? '',
      userId: (json['userId'] as String?) ?? '',
      professionalId: (json['professionalId'] as String?) ?? '',
      fullName: (json['fullName'] as String?) ?? '',
      goal: json['goal'] as String?,
      status: (json['status'] as String?) ?? 'active',
      username: (json['username'] as String?) ?? '',
      email: (json['email'] as String?) ?? '',
      birthDate: json['birthDate'] as String?,
      heightCm: (json['heightCm'] as num?)?.toDouble(),
      baseWeightKg: (json['baseWeightKg'] as num?)?.toDouble(),
      baseBodyFatPercentage:
          (json['baseBodyFatPercentage'] as num?)?.toDouble(),
      waistCm: (json['waistCm'] as num?)?.toDouble(),
      hipCm: (json['hipCm'] as num?)?.toDouble(),
    );
  }
}

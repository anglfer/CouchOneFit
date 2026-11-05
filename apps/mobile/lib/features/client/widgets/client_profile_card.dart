import 'package:flutter/material.dart';

import '../../../shared/theme/app_theme.dart';
import '../models/client_profile.dart';

/// Identity card at the top of Cuenta.
class ClientProfileCard extends StatelessWidget {
  const ClientProfileCard({super.key, required this.profile});

  final ClientProfile profile;

  String get _initials {
    final parts = profile.fullName.trim().split(RegExp(r'\s+'));
    if (parts.first.isEmpty) return 'C';
    return (parts.first.characters.first +
            (parts.length > 1 ? parts.last.characters.first : ''))
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    const soft = Color(0xDDFFFFFF);
    return Container(
      key: const ValueKey('client_profile_card'),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          gradient: BrandColors.gradient,
          borderRadius: BorderRadius.circular(24)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          ExcludeSemantics(
              child: Container(
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                      shape: BoxShape.circle, color: Colors.white),
                  child: Text(_initials,
                      style: const TextStyle(
                          color: BrandColors.primary,
                          fontSize: 24,
                          fontWeight: FontWeight.w800)))),
          const SizedBox(width: 16),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(profile.fullName,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 21,
                        height: 1.2,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4)),
                const SizedBox(height: 4),
                Text('@${profile.username}',
                    style: const TextStyle(color: soft, fontSize: 14)),
              ])),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          const Icon(Icons.mail_outline_rounded, size: 16, color: soft),
          const SizedBox(width: 8),
          Expanded(
              child: Text(profile.email,
                  style: const TextStyle(color: soft, fontSize: 14))),
        ]),
        const SizedBox(height: 12),
        Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .18),
                borderRadius: BorderRadius.circular(99)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.verified_user_outlined, size: 15, color: Colors.white),
              SizedBox(width: 6),
              Flexible(
                  child: Text('Cuenta activa',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700))),
            ])),
      ]),
    );
  }
}

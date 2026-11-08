import 'package:flutter/material.dart';

import '../../../shared/theme/app_theme.dart';
import '../models/client_profile.dart';

/// Centered identity header at the top of Cuenta.
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
    final colors = Theme.of(context).colorScheme;
    return Card(
      key: const ValueKey('client_profile_card'),
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
        child: Column(children: [
          ExcludeSemantics(
              child: Container(
                  width: 84,
                  height: 84,
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: BrandColors.gradient,
                      boxShadow: [
                        BoxShadow(
                            color: colors.primary.withValues(alpha: 0.28),
                            blurRadius: 20,
                            offset: const Offset(0, 6))
                      ]),
                  child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                          shape: BoxShape.circle, color: colors.surface),
                      child: Text(_initials,
                          style: TextStyle(
                              color: colors.primary,
                              fontSize: 28,
                              fontWeight: FontWeight.w800))))),
          const SizedBox(height: 12),
          Text(profile.fullName,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 22,
                  height: 1.2,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4)),
          const SizedBox(height: 4),
          Text('@${profile.username}',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: colors.secondary)),
          const SizedBox(height: 2),
          Text(profile.email,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, color: colors.onSurfaceVariant)),
          const SizedBox(height: 12),
          Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(
                  color: BrandColors.success.withValues(alpha: .15),
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(
                      color: BrandColors.success.withValues(alpha: .35))),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.verified_user_outlined,
                    size: 15, color: BrandColors.success),
                const SizedBox(width: 6),
                Flexible(
                    child: Text('Cuenta activa',
                        style: TextStyle(
                            color: colors.onSurface,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700))),
              ])),
        ]),
      ),
    );
  }
}

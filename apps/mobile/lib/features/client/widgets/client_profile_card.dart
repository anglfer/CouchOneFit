import 'package:flutter/material.dart';

import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../models/client_profile.dart';

/// Identity header at the top of Cuenta.
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
    return Row(
      key: const ValueKey('client_profile_card'),
      children: [
        ExcludeSemantics(
            child: Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    shape: BoxShape.circle, color: actionFill(context)),
                child: Text(_initials,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w800)))),
        const SizedBox(width: 16),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(profile.fullName,
              style: const TextStyle(
                  fontSize: 21,
                  height: 1.2,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3)),
          const SizedBox(height: 2),
          Text('@${profile.username}',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: colors.secondary)),
          Text(profile.email,
              style: TextStyle(fontSize: 13.5, color: colors.onSurfaceVariant)),
          const SizedBox(height: 8),
          const TonePill('Cuenta activa',
              tone: BrandColors.success, icon: Icons.verified_user_outlined),
        ])),
      ],
    );
  }
}

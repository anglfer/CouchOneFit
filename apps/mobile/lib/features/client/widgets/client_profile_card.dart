import 'package:flutter/material.dart';

import '../../../shared/theme/app_theme.dart';
import '../models/client_profile.dart';

class ClientProfileCard extends StatelessWidget {
  const ClientProfileCard({
    super.key,
    required this.profile,
    required this.onRefresh,
    required this.onLogout,
    this.isRefreshing = false,
  });

  final ClientProfile profile;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;
  final bool isRefreshing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final successBg = (dark
            ? BrandColors.statusDark['success']
            : BrandColors.statusLight['success']) ??
        theme.colorScheme.primaryContainer;

    return Card(
      key: const ValueKey('client_profile_card'),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Mi expediente',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: successBg,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'Cuenta activa',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: BrandColors.success,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              profile.fullName,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              '@${profile.username}',
              style: TextStyle(
                fontSize: 14,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              profile.email,
              style: TextStyle(
                fontSize: 14,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const Divider(height: 28),
            const Text(
              'Objetivo actual',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              (profile.goal != null && profile.goal!.trim().isNotEmpty)
                  ? profile.goal!
                  : 'Sin objetivo registrado aún.',
              style: const TextStyle(fontSize: 15),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              key: const ValueKey('refresh_profile_button'),
              onPressed: isRefreshing ? null : onRefresh,
              icon: const Icon(Icons.refresh_outlined),
              label: Text(
                isRefreshing
                    ? 'Actualizando expediente...'
                    : 'Actualizar expediente',
              ),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              key: const ValueKey('logout_button'),
              onPressed: isRefreshing ? null : onLogout,
              icon: const Icon(Icons.logout_outlined),
              label: const Text('Cerrar sesión'),
            ),
          ],
        ),
      ),
    );
  }
}

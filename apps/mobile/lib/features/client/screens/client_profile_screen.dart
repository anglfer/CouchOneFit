import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../models/client_profile.dart';
import '../widgets/client_profile_card.dart';
import '../widgets/client_base_measurements.dart';

class ClientProfileScreen extends StatelessWidget {
  const ClientProfileScreen({
    super.key,
    required this.profile,
    required this.onRefresh,
    required this.onLogout,
    this.isRefreshing = false,
    this.errorMessage,
    this.onCredentials,
  });

  final ClientProfile profile;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;
  final bool isRefreshing;
  final String? errorMessage;
  final VoidCallback? onCredentials;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return RefreshIndicator(
      onRefresh: () async {
        if (!isRefreshing) await onRefresh();
      },
      child: LayoutBuilder(builder: (context, constraints) {
        final horizontal = constraints.maxWidth < 360 ? 16.0 : 24.0;
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(horizontal, 16, horizontal, 28),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  RevealIn(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BIENESTAR PERSONAL',
                            style: TextStyle(
                                color: colorScheme.secondary,
                                fontSize: 11,
                                letterSpacing: 1.8,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        Semantics(
                            header: true,
                            child: Text('Mi expediente',
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineLarge
                                    ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.9))),
                        const SizedBox(height: 8),
                        Text('Tu información. Tu objetivo. Tu siguiente paso.',
                            style: TextStyle(
                                color: colorScheme.onSurfaceVariant,
                                height: 1.5)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (errorMessage != null && errorMessage!.isNotEmpty) ...[
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        key: const Key('client-profile-error'),
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline_rounded,
                                color: colorScheme.onErrorContainer),
                            const SizedBox(width: 12),
                            Expanded(
                                child: Text(errorMessage!,
                                    style: TextStyle(
                                        color: colorScheme.onErrorContainer,
                                        height: 1.4))),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  ClientProfileCard(
                    profile: profile,
                    isRefreshing: isRefreshing,
                    onRefresh: onRefresh,
                    onLogout: onLogout,
                    onCredentials: onCredentials,
                  ),
                  ClientBaseMeasurements(profile: profile),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}

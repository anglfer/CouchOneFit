import 'package:flutter/material.dart';

import '../models/client_profile.dart';
import '../widgets/client_profile_card.dart';

class ClientProfileScreen extends StatelessWidget {
  const ClientProfileScreen({
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
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'CouchOne Fit - Móvil',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),
              ClientProfileCard(
                profile: profile,
                isRefreshing: isRefreshing,
                onRefresh: onRefresh,
                onLogout: onLogout,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

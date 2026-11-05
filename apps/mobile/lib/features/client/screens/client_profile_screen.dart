import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../models/client_profile.dart';
import '../widgets/client_profile_card.dart';
import '../widgets/client_base_measurements.dart';

/// Cuenta: who you are, your prepared record, preferences and access.
class ClientProfileScreen extends StatelessWidget {
  const ClientProfileScreen({
    super.key,
    required this.profile,
    required this.onRefresh,
    required this.onLogout,
    this.isRefreshing = false,
    this.errorMessage,
    this.onCredentials,
    this.settings,
  });

  final ClientProfile profile;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;
  final bool isRefreshing;
  final String? errorMessage;
  final VoidCallback? onCredentials;

  /// Device preferences (Configuración), opened as its own screen.
  final Widget? settings;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    Widget label(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 24, 4, 10),
        child: Text(text,
            style: TextStyle(
                color: colors.secondary,
                fontSize: 11,
                letterSpacing: 1.6,
                fontWeight: FontWeight.w800)));
    Widget group(List<Widget> tiles) => Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          for (var i = 0; i < tiles.length; i++) ...[
            if (i > 0) Divider(height: 1, indent: 56, color: colors.outline),
            tiles[i],
          ]
        ]));
    Widget tile(IconData icon, String title, String subtitle,
            VoidCallback? onTap) =>
        ListTile(
            enabled: onTap == null || !isRefreshing,
            onTap: onTap,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: Icon(icon, color: colors.secondary),
            title: Text(title,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(subtitle),
            trailing:
                onTap == null ? null : const Icon(Icons.chevron_right_rounded));

    return RefreshIndicator(
      onRefresh: () async {
        if (!isRefreshing) await onRefresh();
      },
      child: LayoutBuilder(builder: (context, constraints) {
        final horizontal = constraints.maxWidth < 360 ? 16.0 : 20.0;
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(horizontal, 16, horizontal, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                      header: true,
                      child: Text('Mi cuenta',
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.6))),
                  const SizedBox(height: 2),
                  Text('Tu perfil, tu expediente y tus preferencias',
                      style: TextStyle(
                          fontSize: 15, color: colors.onSurfaceVariant)),
                  const SizedBox(height: 16),
                  if (errorMessage != null && errorMessage!.isNotEmpty) ...[
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        key: const Key('client-profile-error'),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: colors.errorContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline_rounded,
                                color: colors.onErrorContainer),
                            const SizedBox(width: 12),
                            Expanded(
                                child: Text(errorMessage!,
                                    style: TextStyle(
                                        color: colors.onErrorContainer,
                                        height: 1.4))),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  RevealIn(child: ClientProfileCard(profile: profile)),
                  Padding(
                      padding: const EdgeInsets.fromLTRB(4, 24, 4, 10),
                      child: Semantics(
                          header: true,
                          child: Text('Mi expediente',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w800)))),
                  ClientBaseMeasurements(
                      profile: profile,
                      onRefresh: onRefresh,
                      isRefreshing: isRefreshing),
                  if (settings != null) ...[
                    label('PREFERENCIAS'),
                    group([
                      tile(
                          Icons.tune_rounded,
                          'Configuración',
                          'Apariencia, temporizador de descanso e incremento de carga',
                          () => Navigator.push(
                              context,
                              MaterialPageRoute<void>(
                                  builder: (_) => Scaffold(
                                      appBar: AppBar(
                                          title: const Text('Configuración')),
                                      body: SafeArea(
                                          child: ListView(
                                              padding: const EdgeInsets.all(20),
                                              children: [settings!])))))),
                    ]),
                  ],
                  label('SEGURIDAD'),
                  group([
                    tile(
                        Icons.lock_outline_rounded,
                        'Cambiar mis credenciales',
                        'Usuario y contraseña con los que entras',
                        onCredentials),
                  ]),
                  label('ACERCA DE'),
                  group([
                    tile(
                        Icons.handshake_outlined,
                        'Tu profesional',
                        'Diseña y ajusta tu rutina; tú registras lo que haces.',
                        null),
                    tile(Icons.dataset_outlined, 'Datos de ejercicios',
                        'RepDB · repdb.co', null),
                  ]),
                  const SizedBox(height: 24),
                  OutlinedButton.icon(
                      key: const ValueKey('logout_button'),
                      onPressed: isRefreshing ? null : onLogout,
                      style: OutlinedButton.styleFrom(
                          foregroundColor: colors.error,
                          side: BorderSide(color: colors.error)),
                      icon: const Icon(Icons.logout_rounded, size: 18),
                      label: const Text('Cerrar sesión')),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}

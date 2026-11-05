import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../../../shared/theme/app_theme.dart';
import '../../settings/models/app_settings.dart';
import '../../settings/services/settings_controller.dart';
import '../../settings/widgets/settings_panel.dart';
import '../models/client_profile.dart';
import '../widgets/client_profile_card.dart';
import '../widgets/client_base_measurements.dart';

/// Cuenta: who you are, your prepared record, preferences and access,
/// grouped like a settings list (header, record, then sections).
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

  /// Device preferences; without it the Preferencias section is hidden.
  final SettingsController? settings;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    Widget label(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 28, 4, 10),
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
            if (i > 0)
              Divider(height: 1, indent: 68, color: colors.outlineVariant),
            tiles[i],
          ]
        ]));
    Widget tile(IconData icon, Color tint, String title, String subtitle,
            VoidCallback? onTap, {Key? key, Widget? trailing}) =>
        ListTile(
            key: key,
            enabled: onTap == null || !isRefreshing,
            onTap: onTap,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                    color: tint.withValues(alpha: .15),
                    borderRadius: BorderRadius.circular(11)),
                child: Icon(icon, size: 20, color: tint)),
            title: Text(title,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(subtitle),
            trailing: trailing ??
                (onTap == null
                    ? null
                    : Icon(Icons.chevron_right_rounded,
                        color: colors.onSurfaceVariant)));

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
                      padding: const EdgeInsets.fromLTRB(4, 28, 4, 10),
                      child: Row(children: [
                        Expanded(
                            child: Semantics(
                                header: true,
                                child: Text('Mi expediente',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge
                                        ?.copyWith(
                                            fontWeight: FontWeight.w800)))),
                        _StatusPill(active: profile.status == 'active'),
                      ])),
                  ClientBaseMeasurements(
                      profile: profile,
                      onRefresh: onRefresh,
                      isRefreshing: isRefreshing),
                  if (settings != null) ...[
                    label('PREFERENCIAS'),
                    ValueListenableBuilder<AppSettings>(
                        valueListenable: settings!,
                        builder: (context, s, _) => group([
                              tile(
                                  themeLabels[s.themeMode]!.$2,
                                  BrandColors.violet,
                                  'Apariencia',
                                  themeLabels[s.themeMode]!.$1,
                                  () => _pickTheme(context, s)),
                              tile(
                                  Icons.timer_outlined,
                                  BrandColors.success,
                                  'Entrenamiento',
                                  trainingSettingsSummary(s),
                                  () => Navigator.push(
                                      context,
                                      MaterialPageRoute<void>(
                                          builder: (_) => Scaffold(
                                              appBar: AppBar(
                                                  title: const Text(
                                                      'Entrenamiento')),
                                              body: SafeArea(
                                                  child: ListView(
                                                      padding:
                                                          const EdgeInsets.all(
                                                              20),
                                                      children: [
                                                    SettingsPanel(
                                                        controller: settings!)
                                                  ])))))),
                            ])),
                  ],
                  label('CUENTA Y SEGURIDAD'),
                  group([
                    tile(
                        Icons.lock_outline_rounded,
                        BrandColors.blue,
                        'Cambiar mis credenciales',
                        'Usuario y contraseña con los que entras',
                        onCredentials),
                  ]),
                  label('ACERCA DE'),
                  group([
                    tile(
                        Icons.handshake_outlined,
                        BrandColors.warning,
                        'Tu profesional',
                        'Diseña y ajusta tu rutina; tú registras lo que haces.',
                        null),
                    tile(Icons.dataset_outlined, colors.onSurfaceVariant,
                        'Datos de ejercicios', 'RepDB · repdb.co', null),
                  ]),
                  const SizedBox(height: 16),
                  group([
                    ListTile(
                        key: const ValueKey('logout_button'),
                        enabled: !isRefreshing,
                        onTap: onLogout,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        leading: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                                color: colors.error.withValues(alpha: .12),
                                borderRadius: BorderRadius.circular(11)),
                            child: Icon(Icons.logout_rounded,
                                size: 20, color: colors.error)),
                        title: Text('Cerrar sesión',
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: colors.error))),
                  ]),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }

  Future<void> _pickTheme(BuildContext context, AppSettings s) async {
    final picked = await showModalBottomSheet<ThemeMode>(
        context: context,
        showDragHandle: true,
        builder: (sheet) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Padding(
                  padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
                  child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Apariencia',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800)))),
              for (final MapEntry(key: mode, value: (name, icon))
                  in themeLabels.entries)
                ListTile(
                    leading: Icon(icon),
                    title: Text(name),
                    selected: mode == s.themeMode,
                    trailing: mode == s.themeMode
                        ? const Icon(Icons.check_rounded)
                        : null,
                    onTap: () => Navigator.pop(sheet, mode)),
              const SizedBox(height: 8),
            ])));
    if (picked != null) await settings!.update(s.copyWith(themeMode: picked));
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.active});
  final bool active;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final tint = active ? BrandColors.success : colors.onSurfaceVariant;
    return Semantics(
        label: 'Expediente ${active ? 'activo' : 'inactivo'}',
        child: ExcludeSemantics(
            child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: tint.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(99)),
                child: Text(active ? 'Activo' : 'Inactivo',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: active ? BrandColors.success : tint)))));
  }
}

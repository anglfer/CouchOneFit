import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/detail_scaffold.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/icon_badge.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/sheet_parts.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../../settings/models/app_settings.dart';
import '../../settings/services/settings_controller.dart';
import '../../settings/widgets/settings_panel.dart';
import '../../training/screens/training_views.dart';
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
        padding: const EdgeInsets.fromLTRB(2, 26, 2, 10),
        child: SectionTitle(text));
    Widget group(List<Widget> tiles) => GroupCard(indent: 68, children: tiles);
    Widget tile(IconData icon, Color tint, String title, String subtitle,
            VoidCallback? onTap, {Key? key, Widget? trailing}) =>
        ListTile(
            key: key,
            enabled: onTap == null || !isRefreshing,
            onTap: onTap,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: IconBadge(icon, tint: tint),
            title: Text(title),
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
          padding: EdgeInsets.fromLTRB(horizontal, 16, horizontal, 44),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const ScreenHeader(
                      title: 'Mi cuenta',
                      subtitle: 'Tu perfil, expediente y preferencias'),
                  if (errorMessage != null && errorMessage!.isNotEmpty)
                    NoticeBanner(
                        key: const Key('client-profile-error'),
                        text: errorMessage!,
                        tone: NoticeTone.error,
                        margin: const EdgeInsets.only(bottom: 16)),
                  RevealIn(child: ClientProfileCard(profile: profile)),
                  Padding(
                      padding: const EdgeInsets.fromLTRB(2, 24, 2, 10),
                      child: SectionTitle('Mi expediente',
                          trailing: Semantics(
                              label:
                                  'Expediente ${profile.status == 'active' ? 'activo' : 'inactivo'}',
                              excludeSemantics: true,
                              child: TonePill(
                                  profile.status == 'active'
                                      ? 'Activo'
                                      : 'Inactivo',
                                  tone: profile.status == 'active'
                                      ? BrandColors.success
                                      : colors.onSurfaceVariant)))),
                  ClientBaseMeasurements(
                      profile: profile,
                      onRefresh: onRefresh,
                      isRefreshing: isRefreshing),
                  if (settings != null) ...[
                    label('Preferencias'),
                    ValueListenableBuilder<AppSettings>(
                        valueListenable: settings!,
                        builder: (context, s, _) => group([
                              tile(
                                  themeLabels[s.themeMode]!.$2,
                                  colors.secondary,
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
                                          builder: (_) => DetailScaffold(
                                                  title: const Text(
                                                      'Entrenamiento'),
                                                  children: [
                                                    SettingsPanel(
                                                        controller: settings!)
                                                  ])))),
                            ])),
                  ],
                  label('Cuenta y seguridad'),
                  group([
                    tile(
                        Icons.lock_outline_rounded,
                        colors.secondary,
                        'Cambiar mis credenciales',
                        'Usuario y contraseña con los que entras',
                        onCredentials),
                  ]),
                  label('Acerca de'),
                  group([
                    tile(
                        Icons.handshake_outlined,
                        BrandColors.warning,
                        'Tu profesional',
                        'Diseña y ajusta tu rutina; tú registras lo que haces.',
                        null),
                    tile(
                        Icons.dataset_outlined,
                        colors.onSurfaceVariant,
                        'Animaciones de ejercicios',
                        '© Gym visual · gymvisual.com',
                        null),
                  ]),
                  const SizedBox(height: 16),
                  group([
                    ListTile(
                        key: const ValueKey('logout_button'),
                        enabled: !isRefreshing,
                        onTap: onLogout,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        leading:
                            IconBadge(Icons.logout_rounded, tint: colors.error),
                        title: Text('Cerrar sesión',
                            style: TextStyle(
                                color: statusInk(context, colors.error)))),
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
        isScrollControlled: true,
        builder: (sheet) => SafeArea(
            child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SheetHeader('Apariencia',
                          subtitle: 'Se guarda solo en este teléfono.'),
                      for (final MapEntry(key: mode, value: (name, icon))
                          in themeLabels.entries)
                        SheetOption(
                            leading: IconBadge(icon),
                            title: name,
                            selected: mode == s.themeMode,
                            onTap: () => Navigator.pop(sheet, mode)),
                    ]))));
    if (picked != null) await settings!.update(s.copyWith(themeMode: picked));
  }
}

import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../../../shared/animations/tactile_bounce.dart';
import '../../../shared/widgets/journey_surface.dart';
import '../models/client_profile.dart';

class ClientProfileCard extends StatelessWidget {
  const ClientProfileCard({
    super.key,
    required this.profile,
    required this.onRefresh,
    required this.onLogout,
    this.isRefreshing = false,
    this.onCredentials,
  });

  final ClientProfile profile;
  final VoidCallback? onCredentials;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;
  final bool isRefreshing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final name = profile.fullName.trim();
    final goal = profile.goal?.trim();
    return Column(
      key: const ValueKey('client_profile_card'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RevealIn(
            delay: const Duration(milliseconds: 60),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                  color: scheme.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: scheme.outlineVariant)),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          ExcludeSemantics(
                              child: Container(
                                  width: 54,
                                  height: 54,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                      color: scheme.primaryContainer,
                                      borderRadius: BorderRadius.circular(18)),
                                  child: Text(
                                      name.isEmpty
                                          ? 'C'
                                          : name.characters.first.toUpperCase(),
                                      style: TextStyle(
                                          color: scheme.secondary,
                                          fontSize: 25,
                                          fontWeight: FontWeight.w700)))),
                          const SizedBox(width: 14),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(profile.fullName,
                                    style: const TextStyle(
                                        fontSize: 21,
                                        height: 1.2,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: -0.5)),
                                const SizedBox(height: 5),
                                Text('@${profile.username}',
                                    style: TextStyle(
                                        color: scheme.onSurfaceVariant,
                                        fontSize: 13)),
                              ])),
                        ]),
                    const SizedBox(height: 22),
                    Divider(height: 1, color: scheme.outlineVariant),
                    const SizedBox(height: 18),
                    Text('CORREO DE ACCESO',
                        style: TextStyle(
                            color: scheme.onSurfaceVariant,
                            fontSize: 10,
                            letterSpacing: 1.3,
                            fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Text(profile.email,
                        style: const TextStyle(fontSize: 14, height: 1.4)),
                    const SizedBox(height: 16),
                    Row(children: [
                      Icon(Icons.check_circle_rounded,
                          size: 15,
                          color: dark
                              ? const Color(0xFF70E6BE)
                              : const Color(0xFF126448)),
                      const SizedBox(width: 7),
                      Flexible(
                          child: Text('Cuenta activa',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: scheme.onSurfaceVariant))),
                    ]),
                  ]),
            )),
        const SizedBox(height: 18),
        RevealIn(
            delay: const Duration(milliseconds: 130),
            child: JourneySurface(
                child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.flag_outlined,
                          size: 20, color: Color(0xFFD0C8FF)),
                      SizedBox(width: 9),
                      Expanded(
                          child: Text('Objetivo actual',
                              style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFFD0C8FF),
                                  fontWeight: FontWeight.w600))),
                    ]),
                    const SizedBox(height: 24),
                    Text(
                        goal != null && goal.isNotEmpty
                            ? profile.goal!
                            : 'Sin objetivo registrado aún.',
                        style: const TextStyle(
                            fontSize: 24,
                            height: 1.25,
                            letterSpacing: -0.5,
                            fontWeight: FontWeight.w600)),
                  ]),
            ))),
        const SizedBox(height: 26),
        Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 12),
            child: Text('TU CUENTA',
                style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.w700))),
        Material(
          color: scheme.surface,
          clipBehavior: Clip.antiAlias,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: scheme.outlineVariant)),
          child: Column(children: [
            if (onCredentials != null) ...[
              ListTile(
                  enabled: !isRefreshing,
                  onTap: onCredentials,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
                  leading: Icon(Icons.lock_outline_rounded,
                      color: scheme.secondary, size: 21),
                  title: const Text('Cambiar mis credenciales',
                      style: TextStyle(fontSize: 14)),
                  trailing: const Icon(Icons.chevron_right_rounded, size: 19)),
              Divider(height: 1, indent: 52, color: scheme.outlineVariant),
            ],
            TactileBounce(
                enabled: !isRefreshing,
                child: ListTile(
                    key: const ValueKey('refresh_profile_button'),
                    enabled: !isRefreshing,
                    onTap: isRefreshing ? null : onRefresh,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
                    leading: isRefreshing
                        ? SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: scheme.secondary))
                        : Icon(Icons.refresh_rounded,
                            color: scheme.secondary, size: 21),
                    title: Text(
                        isRefreshing
                            ? 'Actualizando expediente...'
                            : 'Actualizar expediente',
                        style: const TextStyle(fontSize: 14)),
                    trailing:
                        const Icon(Icons.chevron_right_rounded, size: 19))),
          ]),
        ),
        const SizedBox(height: 14),
        TextButton.icon(
            key: const ValueKey('logout_button'),
            onPressed: isRefreshing ? null : onLogout,
            style: TextButton.styleFrom(
                foregroundColor: scheme.onSurfaceVariant,
                minimumSize: const Size(48, 48)),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Cerrar sesión')),
      ],
    );
  }
}

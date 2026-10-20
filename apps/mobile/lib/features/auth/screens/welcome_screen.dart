import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../../../shared/animations/reveal_in.dart';
import '../../../shared/animations/tactile_bounce.dart';
import '../../../shared/widgets/brand_header.dart';
import '../../../shared/widgets/gradient_widgets.dart';
import '../../../shared/widgets/journey_surface.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen(
      {super.key, required this.onLogin, required this.onActivate});
  final VoidCallback onLogin;
  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return LayoutBuilder(builder: (context, constraints) {
      final compact = constraints.maxHeight < 800;
      final horizontal = constraints.maxWidth < 360 ? 20.0 : 28.0;
      return SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(horizontal, 8, horizontal, 24),
        child: Center(
            child: ConstrainedBox(
          constraints: BoxConstraints(
              maxWidth: 480,
              minHeight: math.max(0, constraints.maxHeight - 32)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const BrandHeader(),
                SizedBox(height: compact ? 28 : 38),
                RevealIn(
                    child: Semantics(
                        header: true,
                        child: Text.rich(
                          TextSpan(children: [
                            const TextSpan(text: 'Tu bienestar,\n'),
                            TextSpan(
                                text: 'a tu ritmo.',
                                style: TextStyle(color: scheme.secondary)),
                          ]),
                          style: TextStyle(
                              fontSize: compact ? 39 : 44,
                              height: 1.06,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1.8),
                        ))),
                const SizedBox(height: 16),
                RevealIn(
                    delay: const Duration(milliseconds: 60),
                    child: Text(
                        'Un espacio personal para cuidar de ti, junto a tu profesional.',
                        style: TextStyle(
                            fontSize: 16,
                            height: 1.55,
                            color: scheme.onSurfaceVariant))),
                SizedBox(height: compact ? 24 : 30),
                RevealIn(
                    delay: const Duration(milliseconds: 120),
                    child: JourneySurface(
                        child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(children: [
                              Icon(Icons.spa_outlined,
                                  color: Color(0xFFD0C8FF), size: 20),
                              SizedBox(width: 8),
                              Expanded(
                                  child: Text('HECHO PARA TI',
                                      style: TextStyle(
                                          color: Color(0xFFD0C8FF),
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 1.8))),
                            ]),
                            SizedBox(height: compact ? 28 : 40),
                            const Text('Tu historia.\nTu siguiente paso.',
                                style: TextStyle(
                                    fontSize: 27,
                                    height: 1.15,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: -0.7)),
                            const SizedBox(height: 20),
                            const Row(children: [
                              Icon(Icons.folder_open_rounded,
                                  size: 16, color: Color(0xFFD0C8FF)),
                              SizedBox(width: 8),
                              Expanded(
                                  child: Text('Tu expediente, siempre contigo',
                                      style: TextStyle(
                                          color: Color(0xFFD0C8FF),
                                          fontSize: 12,
                                          height: 1.4))),
                            ]),
                          ]),
                    ))),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 28),
                child: RevealIn(
                    delay: const Duration(milliseconds: 200),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          GradientActionButton(
                              buttonKey: const ValueKey('welcome_login_button'),
                              label: 'Iniciar sesión',
                              onPressed: onLogin),
                          const SizedBox(height: 12),
                          TactileBounce(
                              child: OutlinedButton(
                                  key:
                                      const ValueKey('welcome_activate_button'),
                                  onPressed: onActivate,
                                  style: OutlinedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 18, vertical: 16),
                                      foregroundColor: scheme.onSurface,
                                      side: BorderSide(
                                          color: scheme.outlineVariant),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(16))),
                                  child: const Text('Activar mi cuenta',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w600)))),
                          const SizedBox(height: 16),
                          Text(
                              '¿Primera vez? Activa la invitación de tu profesional.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontSize: 12,
                                  height: 1.5,
                                  color: scheme.onSurfaceVariant)),
                        ])),
              ),
            ],
          ),
        )),
      );
    });
  }
}

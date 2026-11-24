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
      final narrow = constraints.maxWidth < 360;
      final gutter = narrow ? 16.0 : 20.0;
      // The hero takes what the actions leave; on short screens or large text
      // it keeps its content height and the page scrolls.
      final heroHeight =
          (constraints.maxHeight - 240).clamp(0.0, 620.0).toDouble();
      return SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(gutter, 4, gutter, 20),
        child: Center(
            child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              RevealIn(
                  child: JourneySurface(
                      radius: 28,
                      child: IntrinsicHeight(
                          child: ConstrainedBox(
                              constraints:
                                  BoxConstraints(minHeight: heroHeight),
                              child: Padding(
                                  padding: EdgeInsets.all(narrow ? 20 : 24),
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        const BrandHeader(onBrand: true),
                                        const SizedBox(height: 28),
                                        Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Semantics(
                                                  header: true,
                                                  child: Text(
                                                      'Tu bienestar,\na tu ritmo.',
                                                      style: TextStyle(
                                                          fontSize:
                                                              narrow ? 36 : 44,
                                                          height: 1.06,
                                                          fontWeight:
                                                              FontWeight.w800,
                                                          letterSpacing:
                                                              -1.2))),
                                              const SizedBox(height: 14),
                                              const Text(
                                                  'Un espacio personal para cuidar de ti, junto a tu profesional.',
                                                  style: TextStyle(
                                                      fontSize: 16,
                                                      height: 1.5,
                                                      color:
                                                          Color(0xFFE4DEFF))),
                                              const SizedBox(height: 20),
                                              Container(
                                                  padding:
                                                      const EdgeInsets.all(14),
                                                  decoration: BoxDecoration(
                                                      color: const Color(
                                                          0x18FFFFFF),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              16),
                                                      border: Border.all(
                                                          color: const Color(
                                                              0x26FFFFFF))),
                                                  child: const Column(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .stretch,
                                                      children: [
                                                        _WelcomeFeatureRow(
                                                            icon: Icons
                                                                .fitness_center_rounded,
                                                            text:
                                                                'Rutina guiada serie a serie'),
                                                        SizedBox(height: 10),
                                                        _WelcomeFeatureRow(
                                                            icon: Icons
                                                                .restaurant_menu_rounded,
                                                            text:
                                                                'Plan alimenticio y recetas'),
                                                        SizedBox(height: 10),
                                                        _WelcomeFeatureRow(
                                                            icon: Icons
                                                                .insights_rounded,
                                                            text:
                                                                'Check-in diario y progreso'),
                                                      ])),
                                            ]),
                                      ])))))),
              const SizedBox(height: 16),
              RevealIn(
                  delay: const Duration(milliseconds: 160),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        GradientActionButton(
                            buttonKey: const ValueKey('welcome_login_button'),
                            label: 'Iniciar sesión',
                            onPressed: onLogin),
                        const SizedBox(height: 10),
                        TactileBounce(
                            child: OutlinedButton(
                                key: const ValueKey('welcome_activate_button'),
                                onPressed: onActivate,
                                child: const Text('Activar mi cuenta'))),
                        const SizedBox(height: 12),
                        Text(
                            '¿Primera vez? Activa la invitación de tu profesional.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 12.5,
                                height: 1.4,
                                color: scheme.onSurfaceVariant)),
                      ])),
            ],
          ),
        )),
      );
    });
  }
}

class _WelcomeFeatureRow extends StatelessWidget {
  const _WelcomeFeatureRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(children: [
        Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
                color: const Color(0x22FFFFFF),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 16, color: const Color(0xFFEAE6FF))),
        const SizedBox(width: 10),
        Expanded(
            child: Text(text,
                style: const TextStyle(
                    color: Color(0xFFEAE6FF),
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    height: 1.3))),
      ]);
}

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
                                        const SizedBox(height: 40),
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
                                              const SizedBox(height: 18),
                                              const Row(children: [
                                                Icon(Icons.folder_open_rounded,
                                                    size: 16,
                                                    color: Color(0xFFD0C8FF)),
                                                SizedBox(width: 8),
                                                Expanded(
                                                    child: Text(
                                                        'Tu expediente, siempre contigo',
                                                        style: TextStyle(
                                                            color: Color(
                                                                0xFFD0C8FF),
                                                            fontSize: 13,
                                                            fontWeight:
                                                                FontWeight.w600,
                                                            height: 1.4))),
                                              ]),
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

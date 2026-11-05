import 'package:flutter/material.dart';
import '../models/app_settings.dart';
import '../services/settings_controller.dart';
import '../../training/screens/training_views.dart';

String restLabel(int seconds) => seconds % 60 == 0
    ? '${seconds ~/ 60} min'
    : '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

/// "Configuración" block shown inside Cuenta.
class SettingsPanel extends StatelessWidget {
  const SettingsPanel({super.key, required this.controller});
  final SettingsController controller;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    Widget title(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Text(text,
            style: TextStyle(
                fontWeight: FontWeight.w800, color: colors.onSurfaceVariant)));
    return ValueListenableBuilder<AppSettings>(
        valueListenable: controller,
        builder: (context, s, _) =>
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Semantics(
                  header: true,
                  child: Text('Configuración',
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800))),
              const SizedBox(height: 10),
              Card(
                  margin: EdgeInsets.zero,
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        title('Apariencia'),
                        Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: SegmentedButton<ThemeMode>(
                                showSelectedIcon: false,
                                segments: const [
                                  ButtonSegment(
                                      value: ThemeMode.system,
                                      icon: Icon(Icons.brightness_auto),
                                      label: Text('Sistema')),
                                  ButtonSegment(
                                      value: ThemeMode.light,
                                      icon: Icon(Icons.light_mode_outlined),
                                      label: Text('Claro')),
                                  ButtonSegment(
                                      value: ThemeMode.dark,
                                      icon: Icon(Icons.dark_mode_outlined),
                                      label: Text('Oscuro')),
                                ],
                                selected: {s.themeMode},
                                onSelectionChanged: (v) => controller
                                    .update(s.copyWith(themeMode: v.first)))),
                      ])),
              const SizedBox(height: 12),
              Card(
                  margin: EdgeInsets.zero,
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        title('Entrenamiento'),
                        SwitchListTile(
                            title: const Text('Temporizador de descanso'),
                            subtitle: const Text(
                                'Empieza solo al marcar una serie como hecha.'),
                            value: s.restTimer,
                            onChanged: (v) =>
                                controller.update(s.copyWith(restTimer: v))),
                        SwitchListTile(
                            title: const Text('Vibrar al terminar'),
                            subtitle: const Text(
                                'Aviso táctil cuando acaba el descanso.'),
                            value: s.haptics,
                            onChanged: s.restTimer
                                ? (v) =>
                                    controller.update(s.copyWith(haptics: v))
                                : null),
                        _choices<int>(
                            context,
                            'Descanso si tu profesional no lo indicó',
                            AppSettings.restOptions,
                            s.defaultRestSeconds,
                            restLabel,
                            s.restTimer
                                ? (v) => controller
                                    .update(s.copyWith(defaultRestSeconds: v))
                                : null),
                        _choices<double>(
                            context,
                            'Incremento de carga en − / +',
                            AppSettings.stepOptions,
                            s.loadStep,
                            (v) =>
                                '${v % 1 == 0 ? v.toInt() : v.toString().replaceAll('.', ',')} kg',
                            (v) => controller.update(s.copyWith(loadStep: v))),
                        const SizedBox(height: 8),
                      ])),
              Padding(
                  padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
                  child: Text(
                      'Estas preferencias se guardan solo en este teléfono.',
                      style: TextStyle(
                          fontSize: 12, color: colors.onSurfaceVariant))),
            ]));
  }

  Widget _choices<T>(BuildContext context, String label, List<T> options,
          T value, String Function(T) text, ValueChanged<T>? onSelected) =>
      Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label),
            const SizedBox(height: 8),
            ChoiceBar<T>(
                options: [for (final o in options) (o, text(o))],
                selected: value,
                onChanged: onSelected),
          ]));
}

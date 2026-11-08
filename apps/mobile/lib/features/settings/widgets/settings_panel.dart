import 'package:flutter/material.dart';
import '../models/app_settings.dart';
import '../services/settings_controller.dart';
import '../../training/screens/training_views.dart';

String restLabel(int seconds) => seconds % 60 == 0
    ? '${seconds ~/ 60} min'
    : '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

/// Theme names shown in Cuenta › Apariencia.
const themeLabels = {
  ThemeMode.system: ('Según el sistema', Icons.brightness_auto),
  ThemeMode.light: ('Claro', Icons.light_mode_outlined),
  ThemeMode.dark: ('Oscuro', Icons.dark_mode_outlined),
};

/// One-line summary of the training preferences for the Cuenta row.
String trainingSettingsSummary(AppSettings s) => [
      s.restTimer
          ? 'Descanso ${restLabel(s.defaultRestSeconds)}'
          : 'Sin temporizador',
      'carga ±${s.loadStep % 1 == 0 ? s.loadStep.toInt() : s.loadStep.toString().replaceAll('.', ',')} kg',
    ].join(' · ');

/// Training preferences, opened from Cuenta › Entrenamiento.
class SettingsPanel extends StatelessWidget {
  const SettingsPanel({super.key, required this.controller});
  final SettingsController controller;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ValueListenableBuilder<AppSettings>(
        valueListenable: controller,
        builder: (context, s, _) =>
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Card(
                  margin: EdgeInsets.zero,
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),
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
                            'Salto de carga sugerido',
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
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ChoiceBar<T>(
                options: [for (final o in options) (o, text(o))],
                selected: value,
                onChanged: onSelected),
          ]));
}

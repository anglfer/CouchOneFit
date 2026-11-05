import 'package:flutter/material.dart';
import '../models/client_profile.dart';

/// Goal and base values the professional prepared, read only.
class ClientBaseMeasurements extends StatelessWidget {
  const ClientBaseMeasurements(
      {super.key,
      required this.profile,
      required this.onRefresh,
      this.isRefreshing = false});
  final ClientProfile profile;
  final Future<void> Function() onRefresh;
  final bool isRefreshing;

  String measure(double? value, String unit) =>
      value == null ? 'Sin registrar' : '${value.toStringAsFixed(1)} $unit';

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final birth = profile.birthDate;
    final goal = profile.goal?.trim();
    final values = <(String, String, IconData)>[
      (
        'Fecha de nacimiento',
        birth == null ? 'Sin registrar' : birth.split('-').reversed.join('/'),
        Icons.cake_outlined
      ),
      ('Estatura', measure(profile.heightCm, 'cm'), Icons.height),
      (
        'Peso base',
        measure(profile.baseWeightKg, 'kg'),
        Icons.monitor_weight_outlined
      ),
      (
        'Expediente',
        profile.status == 'active' ? 'Activo' : 'Inactivo',
        Icons.folder_shared_outlined
      ),
    ];
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    Icon(Icons.flag_outlined,
                        size: 18, color: colors.secondary),
                    const SizedBox(width: 8),
                    Text('Objetivo',
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: colors.onSurfaceVariant)),
                  ]),
                  const SizedBox(height: 6),
                  Text(
                      goal != null && goal.isNotEmpty
                          ? profile.goal!
                          : 'Sin objetivo registrado aún.',
                      style: const TextStyle(
                          fontSize: 20,
                          height: 1.25,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 18),
                  Semantics(
                      header: true,
                      child: Text('Datos base preparados',
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: colors.onSurfaceVariant))),
                  const SizedBox(height: 10),
                  LayoutBuilder(builder: (context, c) {
                    final width = (c.maxWidth - 10) / 2;
                    return Wrap(spacing: 10, runSpacing: 10, children: [
                      for (final (label, value, icon) in values)
                        Semantics(
                            label: '$label: $value',
                            child: ExcludeSemantics(
                                child: Container(
                                    width: width,
                                    // Same height even when a label wraps.
                                    constraints:
                                        const BoxConstraints(minHeight: 84),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                        color: colors.surfaceContainerHighest,
                                        borderRadius:
                                            BorderRadius.circular(14)),
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(children: [
                                            Icon(icon,
                                                size: 15,
                                                color: colors.onSurfaceVariant),
                                            const SizedBox(width: 6),
                                            Flexible(
                                                child: Text(label,
                                                    style: TextStyle(
                                                        fontSize: 12,
                                                        color: colors
                                                            .onSurfaceVariant))),
                                          ]),
                                          const SizedBox(height: 6),
                                          Text(value,
                                              style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w800)),
                                        ])))),
                    ]);
                  }),
                  const SizedBox(height: 12),
                  Text(
                      'Son tus medidas iniciales registradas por tu profesional, no tu progreso. La evolución de tus medidas todavía no está disponible; tu avance de entrenamiento está en Progreso.',
                      style: TextStyle(
                          fontSize: 12.5, color: colors.onSurfaceVariant)),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                      key: const ValueKey('refresh_profile_button'),
                      onPressed: isRefreshing ? null : onRefresh,
                      icon: isRefreshing
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.refresh_rounded),
                      label: Text(isRefreshing
                          ? 'Actualizando expediente...'
                          : 'Actualizar expediente')),
                ])));
  }
}

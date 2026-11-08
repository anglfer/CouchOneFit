import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../models/client_profile.dart';

/// Goal and base values the professional prepared, read only.
class ClientBaseMeasurements extends StatelessWidget {
  const ClientBaseMeasurements(
      {super.key,
      required this.profile,
      required this.onRefresh,
      this.isRefreshing = false,
      this.today});
  final ClientProfile profile;
  final Future<void> Function() onRefresh;
  final bool isRefreshing;

  /// Injected for tests; defaults to now.
  final DateTime? today;

  String measure(double? value, String unit) =>
      value == null ? 'Sin registrar' : '${value.toStringAsFixed(1)} $unit';

  int? _age(String? birth) {
    final date = birth == null ? null : DateTime.tryParse(birth);
    if (date == null) return null;
    final now = today ?? DateTime.now();
    final age = now.year -
        date.year -
        (now.month < date.month ||
                (now.month == date.month && now.day < date.day)
            ? 1
            : 0);
    return age < 0 ? null : age;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final birth = profile.birthDate;
    final goal = profile.goal?.trim();
    final age = _age(birth);
    final values = <(String, String, String?, IconData)>[
      (
        'Fecha de nacimiento',
        birth == null ? 'Sin registrar' : birth.split('-').reversed.join('/'),
        age == null ? null : '$age años',
        Icons.cake_outlined
      ),
      ('Estatura', measure(profile.heightCm, 'cm'), null, Icons.height),
      (
        'Peso base',
        measure(profile.baseWeightKg, 'kg'),
        null,
        Icons.monitor_weight_outlined
      ),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // Goal as the hero card, like the target card in nutrition apps.
      Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
              gradient: BrandColors.gradient,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
              boxShadow: [
                BoxShadow(
                    color: colors.primary.withValues(alpha: 0.24),
                    blurRadius: 20,
                    offset: const Offset(0, 6))
              ]),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .18),
                    borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.flag_rounded, color: Colors.white)),
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  const Text('Objetivo',
                      style: TextStyle(
                          color: Color(0xDDFFFFFF),
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                      goal != null && goal.isNotEmpty
                          ? profile.goal!
                          : 'Sin objetivo registrado aún.',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 19,
                          height: 1.25,
                          fontWeight: FontWeight.w800)),
                ])),
          ])),
      const SizedBox(height: 12),
      Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                child: Semantics(
                    header: true,
                    child: Text('Datos base preparados',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: colors.onSurfaceVariant)))),
            for (final (index, (label, value, extra, icon))
                in values.indexed) ...[
              if (index > 0)
                Divider(height: 1, indent: 52, color: colors.outlineVariant),
              Semantics(
                  label: '$label: $value${extra == null ? '' : ', $extra'}',
                  child: ExcludeSemantics(
                      child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                          child: Row(children: [
                            Icon(icon, size: 20, color: colors.secondary),
                            const SizedBox(width: 16),
                            Expanded(
                                child: Text(label,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600))),
                            const SizedBox(width: 8),
                            Flexible(
                                child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                  Text(value,
                                      textAlign: TextAlign.end,
                                      style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800)),
                                  if (extra != null)
                                    Text(extra,
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: colors.onSurfaceVariant)),
                                ])),
                          ])))),
            ],
            Divider(height: 1, color: colors.outlineVariant),
            Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(
                    'Son tus medidas iniciales registradas por tu profesional, no tu progreso. La evolución de tus medidas todavía no está disponible; tu avance de entrenamiento está en Progreso.',
                    style: TextStyle(
                        fontSize: 12.5, color: colors.onSurfaceVariant))),
            Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                child: Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                        key: const ValueKey('refresh_profile_button'),
                        onPressed: isRefreshing ? null : onRefresh,
                        icon: isRefreshing
                            ? const SizedBox.square(
                                dimension: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.refresh_rounded),
                        label: Text(isRefreshing
                            ? 'Actualizando expediente...'
                            : 'Actualizar expediente')))),
          ])),
    ]);
  }
}

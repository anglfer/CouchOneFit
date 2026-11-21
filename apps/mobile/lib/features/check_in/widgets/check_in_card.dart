import 'package:flutter/material.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../training/models/training.dart';
import '../../training/screens/training_views.dart';
import '../models/check_in.dart';
import '../screens/check_in_screen.dart';

/// HU-035: today's check-in state on Inicio. Its errors never hide the rest.
class CheckInCard extends StatelessWidget {
  const CheckInCard(
      {super.key,
      required this.context_,
      required this.loading,
      required this.error,
      required this.onOpen,
      required this.onRetry});
  final CheckInContext? context_;
  final bool loading;
  final String? error;
  final ValueChanged<String> onOpen;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final data = context_;
    if (data == null) {
      if (error != null) {
        return NoticeBanner(
            text: error!,
            tone: NoticeTone.error,
            onRetry: loading ? null : onRetry);
      }
      return const SizedBox.shrink();
    }
    final today = data.checkIn;
    final parts = <String>[
      if (today?.bodyWeightKg != null)
        '${trainingDecimal(today!.bodyWeightKg!)} kg',
      if (today?.sleepHours != null)
        '${trainingDecimal(today!.sleepHours!)} h de sueño',
      if (today?.energy != null) 'energía ${today!.energy}/5',
    ];
    final missing = data.missing;
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CardTitle(
                      icon: Icons.monitor_weight_outlined,
                      title: 'Check-in de hoy',
                      action: data.canWrite
                          ? (today == null ? 'Registrar' : 'Editar')
                          : 'Ver',
                      onAction: () => onOpen(data.today)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Icon(
                        today == null
                            ? Icons.radio_button_unchecked
                            : Icons.check_circle,
                        size: 20,
                        color: today == null
                            ? colors.onSurfaceVariant
                            : colors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(
                            today == null
                                ? 'Pendiente: registra tu peso, sueño y cómo te sientes.'
                                : parts.isEmpty
                                    ? 'Registrado'
                                    : 'Registrado · ${parts.join(' · ')}',
                            style:
                                const TextStyle(fontWeight: FontWeight.w700))),
                  ]),
                  if (data.canWrite && missing.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text('Te faltó:',
                              style: TextStyle(color: colors.onSurfaceVariant)),
                          for (final date in missing)
                            ActionChip(
                                label: Text(relativeDayLabel(date, data.today)),
                                onPressed: () => onOpen(date)),
                        ]),
                  ],
                ])));
  }
}

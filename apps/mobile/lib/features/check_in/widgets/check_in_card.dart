import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/tone_pill.dart';
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
    final chips = <(IconData, String)>[
      if (today?.bodyWeightKg != null)
        (
          Icons.monitor_weight_outlined,
          '${trainingDecimal(today!.bodyWeightKg!)} kg'
        ),
      if (today?.sleepHours != null)
        (
          Icons.bedtime_outlined,
          '${trainingDecimal(today!.sleepHours!)} h sueño'
        ),
      if (today?.energy != null)
        (Icons.bolt_rounded, 'Energía ${today!.energy}/5'),
    ];
    final missing = data.missing;
    return Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
            onTap: () => onOpen(data.today),
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
                      const SizedBox(height: 10),
                      Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            TonePill(today == null ? 'Pendiente' : 'Registrado',
                                tone: today == null
                                    ? BrandColors.warning
                                    : BrandColors.success,
                                icon: today == null
                                    ? Icons.schedule_rounded
                                    : Icons.check_circle_rounded),
                            if (today == null)
                              Text('Registra tu peso, sueño y cómo te sientes.',
                                  style: TextStyle(
                                      fontSize: 13.5,
                                      color: colors.onSurfaceVariant)),
                          ]),
                      if (today != null && chips.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Wrap(spacing: 6, runSpacing: 6, children: [
                          for (final (icon, text) in chips)
                            TrainingChip(text, icon: icon),
                        ]),
                      ],
                      if (data.canWrite && missing.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            decoration:
                                innerPanelDecoration(context, radius: 12),
                            child: Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text('Te faltó:',
                                      style: TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w700,
                                          color: colors.onSurfaceVariant)),
                                  for (final date in missing)
                                    ActionChip(
                                        label: Text(
                                            relativeDayLabel(date, data.today)),
                                        onPressed: () => onOpen(date)),
                                ])),
                      ],
                    ]))));
  }
}

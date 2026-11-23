import 'package:flutter/material.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../settings/models/app_settings.dart';
import '../../settings/services/settings_controller.dart';
import '../../training/models/training.dart';
import '../../training/screens/training_views.dart';
import '../models/notification_models.dart';
import '../services/notification_service.dart';

String mealLeadLabel(int minutes) =>
    minutes == 0 ? 'En la hora' : '$minutes min';

/// One-line summary of notification preferences shown in Cuenta › Preferencias.
String notificationSettingsSummary(AppSettings s) {
  final mealPart = s.mealReminderLeadMinutes == 0
      ? 'Comidas en la hora'
      : 'Comidas ${s.mealReminderLeadMinutes} min antes';
  if (s.workoutNotification && s.mealReminders) {
    return 'Entreno activo · $mealPart';
  }
  if (s.workoutNotification) return 'Solo entreno activo';
  if (s.mealReminders) return mealPart;
  return 'Desactivadas';
}

/// Notification preferences, opened from Cuenta › Preferencias › Notificaciones.
class NotificationSettingsPanel extends StatefulWidget {
  const NotificationSettingsPanel({
    super.key,
    required this.controller,
    this.notificationService,
  });

  final SettingsController controller;
  final NotificationService? notificationService;

  @override
  State<NotificationSettingsPanel> createState() =>
      _NotificationSettingsPanelState();
}

class _NotificationSettingsPanelState extends State<NotificationSettingsPanel>
    with WidgetsBindingObserver {
  bool _systemEnabled = true;
  bool _exactAlarms = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPermission();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkPermission();
  }

  Future<void> _checkPermission() async {
    final service = widget.notificationService;
    if (service == null) return;
    final enabled = await service.areEnabled();
    final exact = await service.canScheduleExactAlarms();
    if (mounted) {
      setState(() {
        _systemEnabled = enabled;
        _exactAlarms = exact;
      });
    }
  }

  Future<void> _enableOrOpenSettings() async {
    final service = widget.notificationService;
    if (service == null) return;
    final granted = await service.requestPermission(force: true);
    if (!granted) {
      await service.openSettings();
    }
    await _checkPermission();
  }

  Future<void> _ensurePermissionOnEnable(bool nextValue) async {
    if (!nextValue) return;
    final service = widget.notificationService;
    if (service == null) return;
    final granted = await service.requestPermission(force: true);
    if (mounted) setState(() => _systemEnabled = granted);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final service = widget.notificationService;
    return ValueListenableBuilder<AppSettings>(
      valueListenable: widget.controller,
      builder: (context, s, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!_systemEnabled) ...[
            NoticeBanner(
              icon: Icons.notifications_off_outlined,
              tone: NoticeTone.warning,
              text:
                  'Las notificaciones están desactivadas en el sistema. Actívalas para recibir controles de entreno y avisos de comida.',
              retryLabel: 'Activar permisos',
              onRetry: _enableOrOpenSettings,
            ),
            const SizedBox(height: 12),
          ] else if (!_exactAlarms && s.mealReminders && service != null) ...[
            NoticeBanner(
              icon: Icons.alarm_outlined,
              tone: NoticeTone.info,
              text:
                  'Sin el permiso «Alarmas y recordatorios», Android puede retrasar los avisos de comida hasta una hora.',
              retryLabel: 'Permitir',
              onRetry: service.openExactAlarmSettings,
            ),
            const SizedBox(height: 12),
          ],
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 6),
                SwitchListTile(
                  title: const Text('Notificación de entreno activo'),
                  subtitle: const Text(
                    'Cronómetro, descanso y botones rápidos en la barra de notificaciones mientras entrenas.',
                  ),
                  value: s.workoutNotification,
                  onChanged: (v) async {
                    await widget.controller
                        .update(s.copyWith(workoutNotification: v));
                    await _ensurePermissionOnEnable(v);
                  },
                ),
                const SizedBox(height: 6),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 6),
                SwitchListTile(
                  title: const Text('Recordatorios de comidas'),
                  subtitle: const Text(
                    'Te avisa antes de cada horario indicado en tu plan nutricional.',
                  ),
                  value: s.mealReminders,
                  onChanged: (v) async {
                    await widget.controller
                        .update(s.copyWith(mealReminders: v));
                    await _ensurePermissionOnEnable(v);
                  },
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Avisar antes de cada comida',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      ChoiceBar<int>(
                        options: [
                          for (final option in AppSettings.mealLeadOptions)
                            (option, mealLeadLabel(option)),
                        ],
                        selected: s.mealReminderLeadMinutes,
                        onChanged: s.mealReminders
                            ? (v) => widget.controller
                                .update(s.copyWith(mealReminderLeadMinutes: v))
                            : null,
                      ),
                    ],
                  ),
                ),
                if (service != null)
                  ValueListenableBuilder<List<ScheduledMealReminder>>(
                    valueListenable: service.scheduledMeals,
                    builder: (context, meals, _) => ValueListenableBuilder<int>(
                      valueListenable: service.skippedMealsCount,
                      builder: (context, skipped, _) {
                        final text = meals.isEmpty
                            ? skipped > 0
                                ? 'Las comidas actuales tienen horarios relativos (ej. "60 min pre"), sin hora fija para programar alarma.'
                                : 'Cuando tu profesional asigne horarios fijos a tus comidas, aparecerán aquí.'
                            : '${trainingCount(meals.length, 'comida con horario programado', 'comidas con horario programado')} en tu plan activo.${skipped > 0 ? ' ($skipped sin hora fija)' : ''}';
                        return Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                          child: Text(
                            text,
                            style: TextStyle(
                              fontSize: 12.5,
                              height: 1.35,
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
            child: Text(
              'Estas preferencias se guardan solo en este teléfono.',
              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}

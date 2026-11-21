import 'package:flutter/material.dart';
import '../../../shared/widgets/sheet_parts.dart';

const String registrationNoticeVersion = '2026-10-15.1';

const List<(String title, String body)> privacyNoticeSections = [
  (
    'Responsable y alcance del sistema',
    'CouchOne Fit es un proyecto demostrativo para profesionales de entrenamiento y nutrición. Antes de operar con datos reales de terceros se requiere publicar razón social, domicilio y buzón de contacto oficial; este aviso no constituye certificación jurídica ni médica.',
  ),
  (
    'Datos tratados y finalidades',
    'Tratamos tus datos de acceso (usuario, correo y contraseña cifrada), tu expediente físico y tu seguimiento diario (peso corporal, sueño, estrés, energía, hambre, adherencia y bitácora por serie) para conectar tu trabajo con el de tu profesional.',
  ),
  (
    'Visibilidad y control de tus registros',
    'Siempre puedes consultar lo que tú registras (sesiones de entrenamiento, check-ins y peso diario). Las evaluaciones antropométricas y el cálculo de adherencia que elabora tu profesional permanecen privados por defecto y solo se muestran si él los habilita.',
  ),
  (
    'Uso sin conexión y seguridad local',
    'La aplicación guarda copias locales cifradas de tu rutina, plan alimenticio e historial propio de peso con una caducidad máxima de 30 días para consultarse sin internet. Al cerrar sesión o cambiar de cuenta se eliminan las lecturas guardadas; nunca se guardan contraseñas, códigos ni tokens en claro.',
  ),
  (
    'Conservación, bajas y derechos',
    'Las cuentas inactivas conservan la integridad histórica de forma lógica. Puedes solicitar corrección o baja a través de tu profesional o administración. Confirmar esta información no implica renuncia de derechos.',
  ),
];

Future<void> showPrivacyNoticeSheet(BuildContext context) {
  final colors = Theme.of(context).colorScheme;
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheet) => SafeArea(
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.72,
        minChildSize: 0.45,
        maxChildSize: 0.92,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            const SheetHeader(
              'Privacidad y condiciones',
              subtitle:
                  'Versión vigente $registrationNoticeVersion · Aviso informativo',
            ),
            const SizedBox(height: 12),
            for (final (title, body) in privacyNoticeSections) ...[
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                body,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.45,
                  color: colors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 14),
            ],
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('Entendido'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

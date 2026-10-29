import 'package:flutter/material.dart';
import '../models/client_profile.dart';

class ClientBaseMeasurements extends StatelessWidget {
  const ClientBaseMeasurements({super.key, required this.profile});
  final ClientProfile profile;

  String measure(double? value, String unit) =>
      value == null ? 'Sin registrar' : '${value.toStringAsFixed(1)} $unit';

  @override
  Widget build(BuildContext context) {
    final birth = profile.birthDate;
    final date =
        birth == null ? 'Sin registrar' : birth.split('-').reversed.join('/');
    final values = <String, String>{
      'Fecha de nacimiento': date,
      'Estatura': measure(profile.heightCm, 'cm'),
      'Peso base': measure(profile.baseWeightKg, 'kg'),
      'Grasa medida inicial': measure(profile.baseBodyFatPercentage, '%'),
      'Cintura inicial': measure(profile.waistCm, 'cm'),
      'Cadera inicial': measure(profile.hipCm, 'cm'),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        Semantics(
            header: true,
            child: Text('Datos base preparados',
                style: Theme.of(context).textTheme.titleLarge)),
        const Text(
            'Son tus medidas iniciales registradas por tu profesional, no tu progreso ni mediciones históricas.'),
        for (final entry in values.entries)
          Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('${entry.key}: ${entry.value}')),
        const Text('Estado del expediente'),
        Text(profile.status == 'active' ? 'Activo' : 'Inactivo'),
        const SizedBox(height: 24),
        Semantics(
            header: true,
            child: Text('Progreso',
                style: Theme.of(context).textTheme.titleLarge)),
        const Text(
            'La consulta de progreso todavía no está disponible. Puedes consultar aquí tus datos iniciales y tu objetivo.'),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/status_view.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../../training/models/training.dart';
import '../../training/screens/training_views.dart';
import '../models/nutrition_plan.dart';

class NutritionPlanView extends StatelessWidget {
  const NutritionPlanView({
    super.key,
    required this.plan,
    required this.loading,
    this.error,
    this.cachedAt,
    required this.onRetry,
  });

  final NutritionPlan? plan;
  final bool loading;
  final String? error;
  final DateTime? cachedAt;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final current = plan;

    if (loading && current == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (error != null) ...[
          NoticeBanner(
            text: error!,
            tone: NoticeTone.error,
            onRetry: loading ? null : onRetry,
          ),
          const SizedBox(height: 12),
        ],
        if (cachedAt != null) ...[
          NoticeBanner(
            icon: Icons.cloud_off_outlined,
            tone: NoticeTone.warning,
            text:
                'Lectura guardada · actualizada ${cachedAt!.toLocal().toString().substring(0, 16)}. Desliza hacia abajo para actualizar.',
          ),
          const SizedBox(height: 12),
        ],
        if (current == null)
          const StatusView(
            icon: Icons.restaurant_menu_outlined,
            title: 'Todavía no tienes un plan alimenticio asignado',
            message:
                'Aquí verás tus comidas, cantidades e indicaciones cuando tu profesional active tu plan.',
          )
        else ...[
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          current.name,
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(fontSize: 22, height: 1.15),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const TonePill('Vigente', tone: BrandColors.success),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Versión ${current.number} · activo desde ${shortDate(current.createdAt.substring(0, 10))}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      TrainingChip(
                        trainingCount(
                          current.meals.length,
                          'comida',
                          'comidas',
                        ),
                        icon: Icons.restaurant_outlined,
                      ),
                      if (current.caloriesTarget != null)
                        TrainingChip(
                          '${current.caloriesTarget!.round()} kcal',
                          icon: Icons.local_fire_department_outlined,
                        ),
                      if (current.proteinTargetG != null)
                        TrainingChip(
                          '${current.proteinTargetG!.round()} g proteína',
                          icon: Icons.egg_alt_outlined,
                        ),
                      if (current.carbsTargetG != null)
                        TrainingChip(
                          '${current.carbsTargetG!.round()} g carbos',
                          icon: Icons.grain_outlined,
                        ),
                      if (current.fatTargetG != null)
                        TrainingChip(
                          '${current.fatTargetG!.round()} g grasas',
                          icon: Icons.water_drop_outlined,
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Sigue las porciones e indicaciones de cada comida definidas por tu profesional.',
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.4,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          SectionTitle(
            trainingCount(
                current.meals.length, 'tiempo de comida', 'tiempos de comida'),
          ),
          const SizedBox(height: 10),
          if (current.meals.isEmpty)
            const StatusView(
              icon: Icons.restaurant_outlined,
              title: 'Plan sin comidas registradas',
              message:
                  'Tu profesional aún no agrega tiempos de comida a este plan.',
            )
          else
            for (final entry in current.meals.asMap().entries) ...[
              _MealCard(index: entry.key + 1, meal: entry.value),
              const SizedBox(height: 12),
            ],
        ],
      ],
    );
  }
}

class _MealCard extends StatelessWidget {
  const _MealCard({required this.index, required this.meal});
  final int index;
  final NutritionMeal meal;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return GroupCard(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.primaryContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$index',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: colors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      meal.name,
                      style: TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w800,
                        color: colors.onSurface,
                      ),
                    ),
                    if (meal.instructions != null &&
                        meal.instructions!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        meal.instructions!,
                        style: TextStyle(
                          fontSize: 13.5,
                          height: 1.35,
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        for (final item in meal.items)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: colors.onSurface,
                        ),
                      ),
                      if (item.instructions != null &&
                          item.instructions!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          item.instructions!,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.3,
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                TonePill(
                  item.quantityLabel,
                  tone: colors.primary,
                ),
              ],
            ),
          ),
      ],
    );
  }
}
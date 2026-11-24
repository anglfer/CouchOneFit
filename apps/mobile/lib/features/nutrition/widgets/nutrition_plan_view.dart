import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/utils/friendly_date.dart';
import '../../../shared/widgets/group_card.dart';
import '../../../shared/widgets/icon_badge.dart';
import '../../../shared/widgets/journey_surface.dart';
import '../../../shared/widgets/notice_banner.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/sheet_parts.dart';
import '../../../shared/widgets/status_view.dart';
import '../../../shared/widgets/tone_pill.dart';
import '../../training/models/training.dart';
import '../../training/screens/training_views.dart';
import '../models/nutrition_plan.dart';

class NutritionPlanView extends StatefulWidget {
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
  State<NutritionPlanView> createState() => _NutritionPlanViewState();
}

class _NutritionPlanViewState extends State<NutritionPlanView> {
  bool _restDay = false;

  @override
  Widget build(BuildContext context) {
    final current = widget.plan;

    if (widget.loading && current == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: StatusView(
          loading: true,
          title: 'Consultando tu plan…',
          message: 'Preparamos tus comidas y objetivos diarios.',
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.error != null) ...[
          NoticeBanner(
            text: widget.error!,
            tone: NoticeTone.error,
            onRetry: widget.loading ? null : widget.onRetry,
          ),
          const SizedBox(height: 12),
        ],
        if (widget.cachedAt != null) ...[
          NoticeBanner(
            icon: Icons.cloud_off_outlined,
            tone: NoticeTone.warning,
            text:
                'Lectura guardada · actualizada ${friendlySavedAt(widget.cachedAt!)}. Desliza hacia abajo para actualizar.',
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
          _NutritionHero(
            plan: current,
            loading: widget.loading,
            restDay: _restDay && current.hasRestDayTargets,
            onToggleRestDay: current.hasRestDayTargets
                ? (next) => setState(() => _restDay = next)
                : null,
            onRefresh: widget.onRetry,
          ),
          if (current.hydrationLabel != null ||
              current.fiberTargetG != null) ...[
            const SizedBox(height: 14),
            StatPanel(
              tiles: [
                if (current.hydrationLabel != null)
                  StatTile(
                    icon: Icons.water_drop_outlined,
                    label: 'Hidratación',
                    value: current.hydrationLabel!,
                  ),
                if (current.fiberTargetG != null)
                  StatTile(
                    icon: Icons.eco_outlined,
                    label: 'Fibra',
                    value: '${current.fiberTargetG!.round()} g',
                  ),
              ],
            ),
          ],
          if (current.hasPeriWorkout) ...[
            const SizedBox(height: 22),
            const SectionTitle('Alrededor de tu entrenamiento'),
            const SizedBox(height: 10),
            _PeriWorkoutCard(peri: current.periWorkout!),
          ],
          if (current.generalInstructions != null &&
              current.generalInstructions!.isNotEmpty) ...[
            const SizedBox(height: 22),
            const SectionTitle('Indicaciones de tu profesional'),
            const SizedBox(height: 10),
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  current.generalInstructions!,
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.45,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          ],
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
              _MealCard(
                index: entry.key + 1,
                meal: entry.value,
                onOpenDetail: () =>
                    _openMealSheet(context, entry.key + 1, entry.value),
                onOpenRecipe: (item) =>
                    _openRecipeSheet(context, item, entry.value.name),
              ),
              const SizedBox(height: 12),
            ],
        ],
      ],
    );
  }

  void _openMealSheet(BuildContext context, int index, NutritionMeal meal) {
    final colors = Theme.of(context).colorScheme;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SheetHeader(
                '$index. ${meal.name}',
                subtitle: [
                  if (meal.scheduleTime != null) meal.scheduleTime!,
                  meal.itemsSummaryLabel,
                  if (meal.macroSummaryLabel != null) meal.macroSummaryLabel!,
                ].join(' · '),
              ),
              if (meal.instructions != null &&
                  meal.instructions!.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: innerPanelDecoration(sheet, radius: 14),
                  child: Text(
                    meal.instructions!,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.4,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
              ],
              GroupCard(
                children: [
                  for (final item in meal.items)
                    _MealItemRow(
                      item: item,
                      onOpenRecipe: item.isRecipe
                          ? () => _openRecipeSheet(sheet, item, meal.name)
                          : null,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openRecipeSheet(
    BuildContext context,
    NutritionItem item,
    String mealName,
  ) {
    final colors = Theme.of(context).colorScheme;
    final maxSheetHeight = MediaQuery.sizeOf(context).height * 0.88;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxSheetHeight),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SheetHeader(
                  item.name,
                  subtitle: 'Receta · ${item.quantityLabel} · $mealName',
                ),
                if (item.calories != null) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: innerPanelDecoration(sheet, radius: 14),
                    child: Wrap(
                      spacing: 10,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        TonePill(
                          '${item.calories!.round()} kcal',
                          tone: colors.primary,
                        ),
                        if (item.proteinG != null)
                          Text(
                            'Proteína ${item.proteinG!.round()} g',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: colors.onSurface,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ],
                            ),
                          ),
                        if (item.carbsG != null)
                          Text(
                            'Carbos ${item.carbsG!.round()} g',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: colors.onSurface,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ],
                            ),
                          ),
                        if (item.fatG != null)
                          Text(
                            'Grasas ${item.fatG!.round()} g',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: colors.onSurface,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (item.recipeIngredients.isNotEmpty) ...[
                  const SectionTitle('Qué necesitas'),
                  const SizedBox(height: 4),
                  Text(
                    'Cantidades para ${item.quantityLabel}',
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 10),
                  GroupCard(
                    children: [
                      for (final ing in item.recipeIngredients)
                        _IngredientRow(ingredient: ing),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
                if (item.hasPreparation) ...[
                  const SectionTitle('Cómo prepararla'),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: innerPanelDecoration(sheet, radius: 14),
                    child: Text(
                      item.instructions!,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: colors.onSurface,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (item.substitutes != null &&
                    item.substitutes!.isNotEmpty) ...[
                  const SectionTitle('Equivalente o sustituto'),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: innerPanelDecoration(sheet, radius: 14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.swap_horiz_rounded,
                          size: 18,
                          color: statusInk(context, colors.secondary),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            item.substitutes!,
                            style: TextStyle(
                              fontSize: 13.5,
                              height: 1.4,
                              color: colors.onSurface,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (item.recipeIngredients.isEmpty && !item.hasPreparation)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: innerPanelDecoration(sheet, radius: 14),
                    child: Text(
                      'Porción prescrita: ${item.quantityLabel}. Sigue las indicaciones de $mealName.',
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.4,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NutritionHero extends StatelessWidget {
  const _NutritionHero({
    required this.plan,
    required this.loading,
    required this.restDay,
    required this.onToggleRestDay,
    required this.onRefresh,
  });

  final NutritionPlan plan;
  final bool loading;
  final bool restDay;
  final ValueChanged<bool>? onToggleRestDay;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final rest = plan.restDayTargets;
    final calories =
        restDay && rest != null ? rest.caloriesTarget : plan.caloriesTarget;
    final protein =
        restDay && rest != null ? rest.proteinTargetG : plan.proteinTargetG;
    final carbs =
        restDay && rest != null ? rest.carbsTargetG : plan.carbsTargetG;
    final fat = restDay && rest != null ? rest.fatTargetG : plan.fatTargetG;

    final createdPrefix = plan.createdAt.length >= 10
        ? shortDate(plan.createdAt.substring(0, 10))
        : plan.createdAt;

    const soft = Color(0xE6FFFFFF);

    return JourneySurface(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0x2EFFFFFF),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          'Vigente · v${plan.number}',
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        'Desde $createdPrefix',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: soft,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Actualizar plan',
                  color: Colors.white,
                  onPressed: loading ? null : onRefresh,
                  icon: loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.refresh_rounded, size: 22),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              plan.name,
              style: const TextStyle(
                fontSize: 24,
                height: 1.15,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
              ),
            ),
            if (onToggleRestDay != null) ...[
              const SizedBox(height: 14),
              _DayToggle(
                restDay: restDay,
                onChanged: onToggleRestDay!,
              ),
            ],
            if (calories != null) ...[
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 2,
                crossAxisAlignment: WrapCrossAlignment.end,
                children: [
                  Text(
                    '${calories.round()}',
                    style: const TextStyle(
                      fontSize: 36,
                      height: 1,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.8,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  Text(
                    onToggleRestDay == null
                        ? 'kcal / día'
                        : restDay
                            ? 'kcal · día de descanso'
                            : 'kcal · día de entreno',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: soft,
                    ),
                  ),
                ],
              ),
            ],
            if (protein != null || carbs != null || fat != null) ...[
              const SizedBox(height: 14),
              _HeroMacroBar(
                proteinG: protein,
                carbsG: carbs,
                fatG: fat,
              ),
            ] else ...[
              const SizedBox(height: 8),
              const Text(
                'Sigue las porciones e indicaciones de cada comida definidas por tu profesional.',
                style: TextStyle(fontSize: 13.5, height: 1.4, color: soft),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DayToggle extends StatelessWidget {
  const _DayToggle({required this.restDay, required this.onChanged});

  final bool restDay;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget segment(bool targetRest, String label) {
      final selected = restDay == targetRest;
      return Expanded(
        child: Semantics(
          button: true,
          selected: selected,
          label: label,
          onTap: () => onChanged(targetRest),
          child: ExcludeSemantics(
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => onChanged(targetRest),
              child: Container(
                height: 40,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: selected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    maxLines: 1,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: selected
                          ? const Color(0xFF1A1140)
                          : const Color(0xE6FFFFFF),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0x24FFFFFF),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Row(
        children: [
          segment(false, 'Entreno'),
          segment(true, 'Descanso'),
        ],
      ),
    );
  }
}

class _HeroMacroBar extends StatelessWidget {
  const _HeroMacroBar({
    required this.proteinG,
    required this.carbsG,
    required this.fatG,
  });

  final num? proteinG;
  final num? carbsG;
  final num? fatG;

  static const _protColor = Color(0xFFB5A4FF);
  static const _carbsColor = Color(0xFF38BDF8);
  static const _fatColor = Color(0xFFFBBF24);

  @override
  Widget build(BuildContext context) {
    final pKcal = ((proteinG ?? 0) * 4).round();
    final cKcal = ((carbsG ?? 0) * 4).round();
    final fKcal = ((fatG ?? 0) * 9).round();
    final total = pKcal + cKcal + fKcal;

    final pPct = total > 0 ? ((pKcal / total) * 100).round() : 0;
    final cPct = total > 0 ? ((cKcal / total) * 100).round() : 0;
    final fPct = total > 0 ? (100 - pPct - cPct).clamp(0, 100) : 0;

    final metrics = [
      (
        label: 'Proteína',
        grams: proteinG,
        pct: pPct,
        color: _protColor,
      ),
      (
        label: 'Carbos',
        grams: carbsG,
        pct: cPct,
        color: _carbsColor,
      ),
      (
        label: 'Grasas',
        grams: fatG,
        pct: fPct,
        color: _fatColor,
      ),
    ];

    Widget cell(
      ({String label, num? grams, int pct, Color color}) item,
    ) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0x1FFFFFFF),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: item.color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      item.label,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xE6FFFFFF),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                item.grams != null ? '${item.grams!.round()} g' : '—',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ),
            if (total > 0 && item.grams != null)
              Text(
                '${item.pct}%',
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xCCFFFFFF),
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
          ],
        ),
      );
    }

    return Semantics(
      label:
          'Macronutrientes: Proteína ${proteinG?.round() ?? 0} gramos, Carbohidratos ${carbsG?.round() ?? 0} gramos, Grasas ${fatG?.round() ?? 0} gramos',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (total > 0) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: SizedBox(
                  height: 8,
                  child: Row(
                    children: [
                      if (pKcal > 0)
                        Expanded(
                          flex: pKcal,
                          child: const ColoredBox(color: _protColor),
                        ),
                      if (cKcal > 0)
                        Expanded(
                          flex: cKcal,
                          child: const ColoredBox(color: _carbsColor),
                        ),
                      if (fKcal > 0)
                        Expanded(
                          flex: fKcal,
                          child: const ColoredBox(color: _fatColor),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            LayoutBuilder(
              builder: (context, constraints) {
                final stacked = constraints.maxWidth < 250 ||
                    MediaQuery.textScalerOf(context).scale(12) > 21;
                if (stacked) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (i, m) in metrics.indexed) ...[
                        if (i > 0) const SizedBox(height: 8),
                        cell(m),
                      ],
                    ],
                  );
                }
                return Row(
                  children: [
                    for (final (i, m) in metrics.indexed) ...[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(child: cell(m)),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PeriWorkoutCard extends StatelessWidget {
  const _PeriWorkoutCard({required this.peri});

  final NutritionPeriWorkout peri;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    Widget row(String title, String detail, IconData icon, Color tint) =>
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              IconBadge(icon, size: 36, tint: tint),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      detail,
                      style: TextStyle(
                        fontSize: 13.5,
                        color: colors.onSurfaceVariant,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );

    return GroupCard(
      children: [
        row(
          'Pre-entreno',
          '${peri.preProteinG.round()}g proteína · ${peri.preCarbsG.round()}g carbos · ${peri.preFatG.round()}g grasas',
          Icons.bolt_outlined,
          BrandColors.warning,
        ),
        if (peri.intraCarbsG > 0)
          row(
            'Intra-entreno',
            '${peri.intraCarbsG.round()}g carbos líquidos durante la sesión',
            Icons.water_drop_outlined,
            const Color(0xFF0EA5E9),
          ),
        row(
          'Post-entreno',
          '${peri.postProteinG.round()}g proteína · ${peri.postCarbsG.round()}g carbos · ${peri.postFatG.round()}g grasas',
          Icons.fitness_center_outlined,
          BrandColors.success,
        ),
        if (peri.notes != null && peri.notes!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
            child: Text(
              peri.notes!,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
      ],
    );
  }
}

class _MealCard extends StatelessWidget {
  const _MealCard({
    required this.index,
    required this.meal,
    required this.onOpenDetail,
    required this.onOpenRecipe,
  });

  final int index;
  final NutritionMeal meal;
  final VoidCallback onOpenDetail;
  final ValueChanged<NutritionItem> onOpenRecipe;

  IconData _categoryIcon(String? category) => switch (category) {
        'breakfast' => Icons.wb_sunny_outlined,
        'morning_snack' => Icons.apple_outlined,
        'lunch' => Icons.restaurant_outlined,
        'pre_workout' => Icons.bolt_outlined,
        'post_workout' => Icons.fitness_center_outlined,
        'afternoon_snack' => Icons.coffee_outlined,
        'dinner' => Icons.dinner_dining_outlined,
        'pre_bed' => Icons.bedtime_outlined,
        _ => Icons.restaurant_menu_outlined,
      };

  Color _categoryTint(String? category, ColorScheme colors) =>
      switch (category) {
        'breakfast' => BrandColors.warning,
        'morning_snack' || 'afternoon_snack' => BrandColors.success,
        'lunch' => const Color(0xFF0EA5E9),
        'pre_workout' || 'post_workout' => colors.primary,
        _ => colors.secondary,
      };

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final macroLabel = meal.macroSummaryLabel;
    final categoryTint = _categoryTint(meal.category, colors);
    return GroupCard(
      children: [
        InkWell(
          onTap: onOpenDetail,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                IconBadge(
                  _categoryIcon(meal.category),
                  tint: categoryTint,
                  size: 40,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$index. ${meal.name}',
                        style: TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          color: colors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (meal.scheduleTime != null &&
                              meal.scheduleTime!.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: colors.secondary.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.schedule_rounded,
                                    size: 12.5,
                                    color: statusInk(context, colors.secondary),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    meal.scheduleTime!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      fontFeatures: const [
                                        FontFeature.tabularFigures()
                                      ],
                                      color:
                                          statusInk(context, colors.secondary),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          Text(
                            meal.itemsSummaryLabel,
                            style: TextStyle(
                              fontSize: 12.5,
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                          if (macroLabel != null)
                            Text(
                              macroLabel,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: colors.onSurfaceVariant,
                                fontFeatures: const [
                                  FontFeature.tabularFigures()
                                ],
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: colors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
        if (meal.instructions != null && meal.instructions!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(
              meal.instructions!,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.38,
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
        for (final item in meal.items)
          _MealItemRow(
            item: item,
            onOpenRecipe: item.isRecipe ? () => onOpenRecipe(item) : null,
          ),
      ],
    );
  }
}

class _IngredientRow extends StatelessWidget {
  const _IngredientRow({required this.ingredient});

  final NutritionRecipeIngredient ingredient;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final pill = TonePill(ingredient.quantityLabel, tone: colors.primary);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final narrowScaled = constraints.maxWidth < 290 &&
              MediaQuery.textScalerOf(context).scale(14) > 20;
          if (narrowScaled) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ingredient.name,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: colors.onSurface,
                  ),
                ),
                const SizedBox(height: 6),
                pill,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  ingredient.name,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: colors.onSurface,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              ConstrainedBox(
                constraints:
                    BoxConstraints(maxWidth: constraints.maxWidth * 0.42),
                child: pill,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _MealItemRow extends StatelessWidget {
  const _MealItemRow({required this.item, this.onOpenRecipe});

  final NutritionItem item;
  final VoidCallback? onOpenRecipe;

  Color _groupTint(String? group, ColorScheme colors) {
    final g = (group ?? '').toLowerCase();
    if (g.contains('prote')) return colors.primary;
    if (g.contains('carbo')) return const Color(0xFF0EA5E9);
    if (g.contains('grasa')) return BrandColors.warning;
    if (g.contains('verdura')) return BrandColors.success;
    if (g.contains('fruta')) return BrandColors.highlight;
    return colors.secondary;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dotColor = _groupTint(item.foodGroup, colors);
    final macros = item.macroSummaryLabel;
    final pill = TonePill(item.quantityLabel, tone: colors.primary);
    final secondaryInk = statusInk(context, colors.secondary);
    final ingredientPreview =
        item.recipeIngredients.take(3).map((ing) => ing.name).join(', ');
    final recipeMeta = [
      if (item.recipeIngredients.isNotEmpty)
        trainingCount(
            item.recipeIngredients.length, 'ingrediente', 'ingredientes'),
      if (item.hasPreparation) 'Con preparación',
    ].join(' · ');

    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (item.isRecipe) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconBadge(
                Icons.restaurant_menu_rounded,
                size: 32,
                tint: colors.secondary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          item.name,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: colors.onSurface,
                          ),
                        ),
                        TonePill('Receta', tone: colors.secondary),
                      ],
                    ),
                    if (recipeMeta.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        recipeMeta,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (ingredientPreview.isNotEmpty) ...[
            const SizedBox(height: 5),
            Padding(
              padding: const EdgeInsets.only(left: 42),
              child: Text(
                item.recipeIngredients.length > 3
                    ? '$ingredientPreview…'
                    : ingredientPreview,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.3,
                  color: colors.onSurfaceVariant,
                ),
              ),
            ),
          ] else if (item.hasPreparation) ...[
            const SizedBox(height: 5),
            Padding(
              padding: const EdgeInsets.only(left: 42),
              child: Text(
                item.instructions!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.3,
                  color: colors.onSurfaceVariant,
                ),
              ),
            ),
          ],
          if (onOpenRecipe != null) ...[
            const SizedBox(height: 5),
            Padding(
              padding: const EdgeInsets.only(left: 42),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      'Ver ingredientes y preparación',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: secondaryInk,
                      ),
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: secondaryInk,
                  ),
                ],
              ),
            ),
          ],
        ] else ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              Expanded(
                child: Text(
                  item.name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: colors.onSurface,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 16),
            child: Text(
              item.foodGroup != null && item.foodGroup!.isNotEmpty
                  ? 'Alimento · ${item.foodGroup!}'
                  : 'Alimento',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
          if (item.instructions != null && item.instructions!.isNotEmpty) ...[
            const SizedBox(height: 3),
            Padding(
              padding: const EdgeInsets.only(left: 16),
              child: Text(
                item.instructions!,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.3,
                  color: colors.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ],
        if (item.substitutes != null && item.substitutes!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Padding(
            padding: EdgeInsets.only(left: item.isRecipe ? 42 : 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.swap_horiz_rounded,
                  size: 15,
                  color: colors.secondary,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Equivalente: ${item.substitutes!}',
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.3,
                      fontWeight: FontWeight.w400,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (macros != null) ...[
          const SizedBox(height: 3),
          Padding(
            padding: EdgeInsets.only(left: item.isRecipe ? 42 : 16),
            child: Text(
              macros,
              style: TextStyle(
                fontSize: 12,
                color: colors.onSurfaceVariant,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ],
    );

    final rowContent = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final narrowScaled = constraints.maxWidth < 290 &&
              MediaQuery.textScalerOf(context).scale(14) > 20;
          if (narrowScaled) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                details,
                const SizedBox(height: 8),
                Padding(
                  padding: EdgeInsets.only(left: item.isRecipe ? 42 : 16),
                  child: pill,
                ),
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: details),
              const SizedBox(width: 10),
              ConstrainedBox(
                constraints:
                    BoxConstraints(maxWidth: constraints.maxWidth * 0.42),
                child: pill,
              ),
            ],
          );
        },
      ),
    );

    if (item.isRecipe && onOpenRecipe != null) {
      final dark = Theme.of(context).brightness == Brightness.dark;
      return Semantics(
        button: true,
        label:
            'Receta ${item.name}, ${item.quantityLabel}. Toca para ver ingredientes y preparación',
        child: Ink(
          color: colors.secondary.withValues(alpha: dark ? 0.07 : 0.045),
          child: InkWell(
            onTap: onOpenRecipe,
            child: rowContent,
          ),
        ),
      );
    }
    return rowContent;
  }
}

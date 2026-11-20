Map<String, dynamic> nutritionObject(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw const FormatException('Estructura de nutrición inválida.');
}

List<dynamic> nutritionList(Object? value) {
  if (value is List<dynamic>) return value;
  throw const FormatException('Lista de nutrición inválida.');
}

String nutritionText(Object? value) {
  if (value is String) return value;
  throw const FormatException('Texto de nutrición inválido.');
}

String? nutritionNullableText(Object? value) {
  if (value == null) return null;
  return nutritionText(value);
}

num nutritionNumber(Object? value) {
  if (value is num && value.isFinite) return value;
  throw const FormatException('Número de nutrición inválido.');
}

num? nutritionNullableNumber(Object? value) {
  if (value == null) return null;
  return nutritionNumber(value);
}

class NutritionDayTargets {
  const NutritionDayTargets({
    required this.caloriesTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
  });

  factory NutritionDayTargets.fromJson(Map<String, dynamic> json) {
    return NutritionDayTargets(
      caloriesTarget: nutritionNumber(json['caloriesTarget']),
      proteinTargetG: nutritionNumber(json['proteinTargetG']),
      carbsTargetG: nutritionNumber(json['carbsTargetG']),
      fatTargetG: nutritionNumber(json['fatTargetG']),
    );
  }

  final num caloriesTarget;
  final num proteinTargetG;
  final num carbsTargetG;
  final num fatTargetG;
}

class NutritionPeriWorkout {
  const NutritionPeriWorkout({
    required this.preCarbsG,
    required this.preProteinG,
    required this.preFatG,
    required this.postCarbsG,
    required this.postProteinG,
    required this.postFatG,
    required this.intraCarbsG,
    this.notes,
  });

  factory NutritionPeriWorkout.fromJson(Map<String, dynamic> json) {
    return NutritionPeriWorkout(
      preCarbsG: nutritionNumber(json['preCarbsG']),
      preProteinG: nutritionNumber(json['preProteinG']),
      preFatG: nutritionNumber(json['preFatG']),
      postCarbsG: nutritionNumber(json['postCarbsG']),
      postProteinG: nutritionNumber(json['postProteinG']),
      postFatG: nutritionNumber(json['postFatG']),
      intraCarbsG: nutritionNumber(json['intraCarbsG']),
      notes: nutritionNullableText(json['notes']),
    );
  }

  final num preCarbsG;
  final num preProteinG;
  final num preFatG;
  final num postCarbsG;
  final num postProteinG;
  final num postFatG;
  final num intraCarbsG;
  final String? notes;
}

class NutritionItem {
  const NutritionItem({
    required this.id,
    required this.name,
    required this.quantity,
    required this.unit,
    this.instructions,
    this.foodGroup,
    this.substitutes,
    this.calories,
    this.proteinG,
    this.carbsG,
    this.fatG,
  });

  factory NutritionItem.fromJson(Map<String, dynamic> json) {
    return NutritionItem(
      id: nutritionText(json['id']),
      name: nutritionText(json['name']),
      quantity: nutritionNumber(json['quantity']),
      unit: nutritionText(json['unit']),
      instructions: nutritionNullableText(json['instructions']),
      foodGroup: nutritionNullableText(json['foodGroup']),
      substitutes: nutritionNullableText(json['substitutes']),
      calories: nutritionNullableNumber(json['calories']),
      proteinG: nutritionNullableNumber(json['proteinG']),
      carbsG: nutritionNullableNumber(json['carbsG']),
      fatG: nutritionNullableNumber(json['fatG']),
    );
  }

  final String id;
  final String name;
  final num quantity;
  final String unit;
  final String? instructions;
  final String? foodGroup;
  final String? substitutes;
  final num? calories;
  final num? proteinG;
  final num? carbsG;
  final num? fatG;

  String get quantityLabel {
    final formatted = quantity % 1 == 0
        ? quantity.toInt().toString()
        : quantity.toStringAsFixed(1);
    return '$formatted $unit';
  }

  String? get macroSummaryLabel {
    if (calories == null) return null;
    final parts = <String>['${calories!.round()} kcal'];
    if (proteinG != null) parts.add('P ${proteinG!.round()}g');
    if (carbsG != null) parts.add('C ${carbsG!.round()}g');
    if (fatG != null) parts.add('G ${fatG!.round()}g');
    return parts.join(' · ');
  }
}

class NutritionMeal {
  const NutritionMeal({
    required this.id,
    required this.name,
    this.instructions,
    this.scheduleTime,
    this.category,
    this.targetCalories,
    this.targetProteinG,
    this.targetCarbsG,
    this.targetFatG,
    required this.items,
  });

  factory NutritionMeal.fromJson(Map<String, dynamic> json) {
    final rawItems = nutritionList(json['items']);
    return NutritionMeal(
      id: nutritionText(json['id']),
      name: nutritionText(json['name']),
      instructions: nutritionNullableText(json['instructions']),
      scheduleTime: nutritionNullableText(json['scheduleTime']),
      category: nutritionNullableText(json['category']),
      targetCalories: nutritionNullableNumber(json['targetCalories']),
      targetProteinG: nutritionNullableNumber(json['targetProteinG']),
      targetCarbsG: nutritionNullableNumber(json['targetCarbsG']),
      targetFatG: nutritionNullableNumber(json['targetFatG']),
      items: [
        for (final raw in rawItems)
          NutritionItem.fromJson(nutritionObject(raw)),
      ],
    );
  }

  final String id;
  final String name;
  final String? instructions;
  final String? scheduleTime;
  final String? category;
  final num? targetCalories;
  final num? targetProteinG;
  final num? targetCarbsG;
  final num? targetFatG;
  final List<NutritionItem> items;

  bool get hasItemMacros => items.any((i) => i.calories != null);

  int get computedCalories =>
      items.fold<int>(0, (sum, i) => sum + (i.calories?.round() ?? 0));

  double get computedProteinG =>
      items.fold<double>(0, (sum, i) => sum + (i.proteinG?.toDouble() ?? 0));

  double get computedCarbsG =>
      items.fold<double>(0, (sum, i) => sum + (i.carbsG?.toDouble() ?? 0));

  double get computedFatG =>
      items.fold<double>(0, (sum, i) => sum + (i.fatG?.toDouble() ?? 0));

  String? get macroSummaryLabel {
    if (hasItemMacros) {
      return '$computedCalories kcal · P ${computedProteinG.round()}g · C ${computedCarbsG.round()}g · G ${computedFatG.round()}g';
    }
    if (targetCalories != null) {
      return 'Guía ${targetCalories!.round()} kcal';
    }
    return null;
  }
}

class NutritionPlan {
  const NutritionPlan({
    required this.id,
    required this.planId,
    required this.number,
    required this.name,
    required this.createdAt,
    required this.meals,
    this.caloriesTarget,
    this.proteinTargetG,
    this.carbsTargetG,
    this.fatTargetG,
    this.generalInstructions,
    this.fiberTargetG,
    this.hydrationTargetMl,
    this.restDayTargets,
    this.periWorkout,
  });

  factory NutritionPlan.fromJson(Map<String, dynamic> json) {
    final rawMeals = nutritionList(json['meals']);
    final rawRest = json['restDayTargets'];
    final rawPeri = json['periWorkout'];
    return NutritionPlan(
      id: nutritionText(json['id']),
      planId: nutritionText(json['planId']),
      number: nutritionNumber(json['number']).toInt(),
      name: nutritionText(json['name']),
      createdAt: nutritionText(json['createdAt']),
      caloriesTarget: nutritionNullableNumber(json['caloriesTarget']),
      proteinTargetG: nutritionNullableNumber(json['proteinTargetG']),
      carbsTargetG: nutritionNullableNumber(json['carbsTargetG']),
      fatTargetG: nutritionNullableNumber(json['fatTargetG']),
      generalInstructions: nutritionNullableText(json['generalInstructions']),
      fiberTargetG: nutritionNullableNumber(json['fiberTargetG']),
      hydrationTargetMl: nutritionNullableNumber(json['hydrationTargetMl']),
      restDayTargets: rawRest == null
          ? null
          : NutritionDayTargets.fromJson(nutritionObject(rawRest)),
      periWorkout: rawPeri == null
          ? null
          : NutritionPeriWorkout.fromJson(nutritionObject(rawPeri)),
      meals: [
        for (final raw in rawMeals)
          NutritionMeal.fromJson(nutritionObject(raw)),
      ],
    );
  }

  final String id;
  final String planId;
  final int number;
  final String name;
  final String createdAt;
  final List<NutritionMeal> meals;
  final num? caloriesTarget;
  final num? proteinTargetG;
  final num? carbsTargetG;
  final num? fatTargetG;
  final String? generalInstructions;
  final num? fiberTargetG;
  final num? hydrationTargetMl;
  final NutritionDayTargets? restDayTargets;
  final NutritionPeriWorkout? periWorkout;

  bool get hasMacros =>
      caloriesTarget != null ||
      proteinTargetG != null ||
      carbsTargetG != null ||
      fatTargetG != null;

  bool get hasRestDayTargets => restDayTargets != null;

  bool get hasPeriWorkout => periWorkout != null;

  String? get hydrationLabel {
    final ml = hydrationTargetMl;
    if (ml == null) return null;
    if (ml >= 1000) {
      final liters = ml / 1000;
      return '${liters.toStringAsFixed(1)} L';
    }
    return '${ml.round()} ml';
  }
}

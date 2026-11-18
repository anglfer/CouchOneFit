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

class NutritionItem {
  const NutritionItem({
    required this.id,
    required this.name,
    required this.quantity,
    required this.unit,
    this.instructions,
  });

  factory NutritionItem.fromJson(Map<String, dynamic> json) {
    return NutritionItem(
      id: nutritionText(json['id']),
      name: nutritionText(json['name']),
      quantity: nutritionNumber(json['quantity']),
      unit: nutritionText(json['unit']),
      instructions: nutritionNullableText(json['instructions']),
    );
  }

  final String id;
  final String name;
  final num quantity;
  final String unit;
  final String? instructions;

  String get quantityLabel {
    final formatted = quantity % 1 == 0
        ? quantity.toInt().toString()
        : quantity.toStringAsFixed(1);
    return '$formatted $unit';
  }
}

class NutritionMeal {
  const NutritionMeal({
    required this.id,
    required this.name,
    this.instructions,
    required this.items,
  });

  factory NutritionMeal.fromJson(Map<String, dynamic> json) {
    final rawItems = nutritionList(json['items']);
    return NutritionMeal(
      id: nutritionText(json['id']),
      name: nutritionText(json['name']),
      instructions: nutritionNullableText(json['instructions']),
      items: [
        for (final raw in rawItems)
          NutritionItem.fromJson(nutritionObject(raw)),
      ],
    );
  }

  final String id;
  final String name;
  final String? instructions;
  final List<NutritionItem> items;
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
  });

  factory NutritionPlan.fromJson(Map<String, dynamic> json) {
    final rawMeals = nutritionList(json['meals']);
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

  bool get hasMacros =>
      caloriesTarget != null ||
      proteinTargetG != null ||
      carbsTargetG != null ||
      fatTargetG != null;
}

import 'package:flutter/material.dart';

abstract final class BrandColors {
  static const blue = Color(0xFF3046EB);
  static const primary = Color(0xFF4037F7);
  static const violet = Color(0xFF6344DC);
  static const gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [blue, primary, violet],
    stops: [0, 0.48, 1],
  );
  static const success = Color(0xFF1FCC92);
  static const warning = Color(0xFFF59E0B);
  static const error = Color(0xFFDC5861);
  static const info = blue;
  static const highlight = Color(0xFFFD4080);
  static const statusLight = {
    'success': Color(0xFFE5FAF3),
    'warning': Color(0xFFFFF5DB),
    'error': Color(0xFFFDEBEC),
    'info': Color(0xFFE8EDFF),
    'highlight': Color(0xFFFFE8F1),
  };
  static const statusDark = {
    'success': Color(0xFF0C382F),
    'warning': Color(0xFF3B2B0B),
    'error': Color(0xFF411A21),
    'info': Color(0xFF1A1650),
    'highlight': Color(0xFF48152B),
  };
}

/// Soft brand glow behind the client screens (stronger at night).
BoxDecoration brandGlow(BuildContext context) {
  final colors = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  return BoxDecoration(
      gradient: RadialGradient(
          center: const Alignment(0, -1.18),
          radius: 1.15,
          colors: [
        colors.primary.withValues(alpha: dark ? .22 : .06),
        BrandColors.violet.withValues(alpha: dark ? .08 : .02),
        Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0),
      ],
          stops: const [
        0,
        0.48,
        1
      ]));
}

/// Subtle layered surface used for nested cards (e.g. today's workout box,
/// set logger groups, and segmented bars).
BoxDecoration innerPanelDecoration(BuildContext context,
    {double radius = 16, Color? borderColor}) {
  final colors = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  return BoxDecoration(
    color: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(
      color: borderColor ?? colors.outline.withValues(alpha: dark ? 0.85 : 0.7),
    ),
  );
}

ThemeData mobileTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  // Night theme: near-black with a deep purple cast (#06040C base, #110D1C
  // cards, #1B1529 nested panels), violet accents (#7C5CFF) and lavender
  // (#B4A0FF) for secondary emphasis. Borders stay hairline-subtle.
  final primary = dark ? const Color(0xFF7C5CFF) : BrandColors.primary;
  final hover = dark ? const Color(0xFF9075FF) : const Color(0xFF3128D9);
  final secondary = dark ? const Color(0xFFB4A0FF) : BrandColors.violet;
  final background = dark ? const Color(0xFF06040C) : const Color(0xFFF6F6FB);
  final surface = dark ? const Color(0xFF110D1C) : Colors.white;
  final surfaceSecondary =
      dark ? const Color(0xFF1B1529) : const Color(0xFFEEF0FB);
  final selected = dark ? const Color(0xFF2B2050) : const Color(0xFFEAE8FF);
  final text = dark ? const Color(0xFFF6F3FF) : const Color(0xFF070C21);
  final textSecondary =
      dark ? const Color(0xFFCBC2EA) : const Color(0xFF222F64);
  final muted = dark ? const Color(0xFF8F86B0) : const Color(0xFF626A90);
  final border = dark ? const Color(0xFF231C36) : const Color(0xFFE1E4F3);
  final navigation = dark ? const Color(0xFF0A0713) : Colors.white;
  final navigationActive = dark ? secondary : BrandColors.primary;
  final navigationInactive =
      dark ? const Color(0xFF857CA6) : const Color(0xFF8D99C0);
  final scheme =
      ColorScheme.fromSeed(seedColor: primary, brightness: brightness).copyWith(
    primary: primary,
    onPrimary: Colors.white,
    primaryContainer: selected,
    onPrimaryContainer: text,
    secondary: secondary,
    onSecondary: dark ? const Color(0xFF120E20) : Colors.white,
    secondaryContainer: surfaceSecondary,
    onSecondaryContainer: text,
    surface: surface,
    onSurface: text,
    onSurfaceVariant: textSecondary,
    surfaceContainerHighest: surfaceSecondary,
    outline: border,
    outlineVariant: border,
    error: BrandColors.error,
    onError: const Color(0xFF070C21),
    errorContainer: dark ? const Color(0xFF411A21) : const Color(0xFFFDEBEC),
    onErrorContainer: text,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  // Explicit styles start from the typography so they keep its font.
  final font = base.textTheme.labelLarge!;
  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: border),
  );
  final rounded =
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  return base.copyWith(
    scaffoldBackgroundColor: background,
    canvasColor: background,
    textTheme:
        base.textTheme.apply(bodyColor: text, displayColor: text).copyWith(
              headlineMedium: base.textTheme.headlineMedium?.copyWith(
                  color: text,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.8),
              titleLarge: base.textTheme.titleLarge
                  ?.copyWith(color: text, fontWeight: FontWeight.w800),
              titleMedium: base.textTheme.titleMedium
                  ?.copyWith(color: text, fontWeight: FontWeight.w700),
            ),
    hintColor: muted,
    hoverColor: hover.withValues(alpha: .08),
    dividerColor: border,
    dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: font.copyWith(
            color: text, fontSize: 20, fontWeight: FontWeight.w800),
        surfaceTintColor: Colors.transparent),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: border)),
    ),
    listTileTheme: ListTileThemeData(
        iconColor: textSecondary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceSecondary,
      border: inputBorder,
      enabledBorder: inputBorder,
      focusedBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: primary, width: 2)),
      labelStyle: TextStyle(color: textSecondary),
      hintStyle: TextStyle(color: muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
      shape: WidgetStatePropertyAll(rounded),
      textStyle: WidgetStatePropertyAll(
          font.copyWith(fontWeight: FontWeight.w700, fontSize: 15)),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return surfaceSecondary;
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.pressed)) {
          return hover;
        }
        return primary;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.disabled) ? muted : Colors.white),
    )),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: dark ? secondary : primary,
        minimumSize: const Size(48, 48),
        side: BorderSide(color: border, width: 1.5),
        textStyle: font.copyWith(fontWeight: FontWeight.w700),
        shape: rounded,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: dark ? secondary : primary,
        minimumSize: const Size(48, 48),
        textStyle: font.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48))),
    chipTheme: base.chipTheme.copyWith(
        backgroundColor: surfaceSecondary,
        selectedColor: selected,
        side: BorderSide.none,
        labelStyle:
            font.copyWith(color: textSecondary, fontWeight: FontWeight.w600),
        shape: const StadiumBorder()),
    segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
      shape: WidgetStatePropertyAll(rounded),
      side: WidgetStatePropertyAll(BorderSide(color: border)),
      backgroundColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? selected : surface),
      foregroundColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? text : textSecondary),
    )),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? Colors.white : muted),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? primary : surfaceSecondary),
      trackOutlineColor: WidgetStatePropertyAll(border),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
        color: primary,
        linearTrackColor: surfaceSecondary,
        circularTrackColor: Colors.transparent),
    bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        dragHandleColor: muted,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)))),
    dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
    snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: dark ? surfaceSecondary : const Color(0xFF15122A),
        contentTextStyle: font.copyWith(
            color: dark ? text : Colors.white, fontWeight: FontWeight.w600),
        actionTextColor: dark ? secondary : const Color(0xFFB8A9FF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
            color: dark ? surfaceSecondary : const Color(0xFF15122A),
            borderRadius: BorderRadius.circular(8)),
        textStyle:
            font.copyWith(color: dark ? text : Colors.white, fontSize: 12)),
    navigationRailTheme: NavigationRailThemeData(
        backgroundColor: navigation,
        indicatorColor: selected,
        selectedIconTheme: IconThemeData(color: navigationActive),
        unselectedIconTheme: IconThemeData(color: navigationInactive),
        selectedLabelTextStyle:
            font.copyWith(color: navigationActive, fontWeight: FontWeight.w800),
        unselectedLabelTextStyle: font.copyWith(color: textSecondary)),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: navigation,
      surfaceTintColor: Colors.transparent,
      indicatorColor: selected,
      iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? navigationActive
                : navigationInactive,
          )),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            color: states.contains(WidgetState.selected)
                ? navigationActive
                : textSecondary,
          )),
    ),
  );
}

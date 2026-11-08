import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../animations/premium_route.dart';

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

  /// Fill of night-theme actions: the violet accent is 4.3:1 under white text,
  /// this step of the same hue reaches 5.6:1.
  static const nightAction = Color(0xFF6A4CF0);

  /// Dark text placed on top of the success fill (white fails contrast there).
  static const onSuccess = Color(0xFF052E22);
}

/// Background of anything carrying white text: buttons, selected segments.
Color actionFill(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? BrandColors.nightAction
        : BrandColors.primary;

/// State colors as small text: the main hues fail AA on white, so the light
/// theme reads a darker ink (DESIGN.md «Estados compartidos»).
Color statusInk(BuildContext context, Color tone) {
  if (Theme.of(context).brightness == Brightness.dark) return tone;
  return switch (tone) {
    BrandColors.success => const Color(0xFF0A7D56),
    BrandColors.warning => const Color(0xFF8A5300),
    BrandColors.error => const Color(0xFFB4323C),
    BrandColors.highlight => const Color(0xFFB8175A),
    _ => tone,
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
  return BoxDecoration(
    color: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(
      color: borderColor ?? colors.outlineVariant,
    ),
  );
}

ThemeData mobileTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  // Night theme: near-black with a deep purple cast, violet accents and
  // lavender for secondary emphasis.
  final primary = dark ? const Color(0xFF7C5CFF) : BrandColors.primary;
  final fill = dark ? BrandColors.nightAction : BrandColors.primary;
  final hover = dark ? const Color(0xFF7A5CFA) : const Color(0xFF3128D9);
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
  final borderStrong = dark ? const Color(0xFF4A4070) : const Color(0xFFC5CAE6);
  final navigation = dark ? const Color(0xFF0A0713) : Colors.white;
  final navigationActive = dark ? secondary : BrandColors.primary;
  final navigationInactive =
      dark ? const Color(0xFF857CA6) : const Color(0xFF626A90);
  final errorInk = dark ? BrandColors.error : const Color(0xFFB4323C);
  final accentText = dark ? secondary : primary;
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
    outline: borderStrong,
    outlineVariant: border,
    error: BrandColors.error,
    onError: const Color(0xFF070C21),
    errorContainer: dark ? const Color(0xFF411A21) : const Color(0xFFFDEBEC),
    onErrorContainer: text,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  // Explicit styles start from the typography so they keep its font.
  final font = base.textTheme.labelLarge!;
  final type = base.textTheme;
  OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: color, width: width),
      );
  final rounded =
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  // Icons and labels follow the field: accent on focus, red on error.
  Color fieldTone(Set<WidgetState> states) => states.contains(WidgetState.error)
      ? errorInk
      : states.contains(WidgetState.focused)
          ? accentText
          : muted;
  return base.copyWith(
    scaffoldBackgroundColor: background,
    canvasColor: background,
    // A tight, athletic scale: heavy display weights with negative tracking,
    // calm body copy with room between lines.
    textTheme: type.apply(bodyColor: text, displayColor: text).copyWith(
          displaySmall: type.displaySmall?.copyWith(
              color: text, fontWeight: FontWeight.w800, letterSpacing: -1.2),
          headlineLarge: type.headlineLarge?.copyWith(
              color: text, fontWeight: FontWeight.w900, letterSpacing: -1),
          headlineMedium: type.headlineMedium?.copyWith(
              color: text, fontWeight: FontWeight.w900, letterSpacing: -0.8),
          headlineSmall: type.headlineSmall?.copyWith(
              color: text, fontWeight: FontWeight.w800, letterSpacing: -0.5),
          titleLarge: type.titleLarge?.copyWith(
              color: text, fontWeight: FontWeight.w800, letterSpacing: -0.3),
          titleMedium: type.titleMedium
              ?.copyWith(color: text, fontWeight: FontWeight.w700),
          titleSmall: type.titleSmall
              ?.copyWith(color: text, fontWeight: FontWeight.w700),
          bodyLarge: type.bodyLarge?.copyWith(color: text, height: 1.45),
          bodySmall:
              type.bodySmall?.copyWith(color: textSecondary, height: 1.35),
          labelLarge: type.labelLarge
              ?.copyWith(color: text, fontWeight: FontWeight.w700),
        ),
    hintColor: muted,
    hoverColor: hover.withValues(alpha: .08),
    dividerColor: border,
    dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: PremiumPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.windows: PremiumPageTransitionsBuilder(),
      TargetPlatform.linux: PremiumPageTransitionsBuilder(),
      TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
    }),
    textSelectionTheme: TextSelectionThemeData(
        cursorColor: primary,
        selectionColor: primary.withValues(alpha: .28),
        selectionHandleColor: primary),
    appBarTheme: AppBarTheme(
        // Transparent bars would otherwise be read as dark: white icons on light.
        systemOverlayStyle:
            dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        backgroundColor: background,
        foregroundColor: text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: font.copyWith(
            color: text,
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3),
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
        titleTextStyle: type.titleMedium?.copyWith(
            color: text, fontSize: 15.5, fontWeight: FontWeight.w700),
        subtitleTextStyle: type.bodyMedium
            ?.copyWith(color: textSecondary, fontSize: 13.5, height: 1.35),
        selectedColor: accentText,
        selectedTileColor: selected,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceSecondary,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      border: inputBorder(border),
      enabledBorder: inputBorder(border),
      disabledBorder: inputBorder(border.withValues(alpha: .5)),
      focusedBorder: inputBorder(primary, 2),
      errorBorder: inputBorder(BrandColors.error, 1.4),
      focusedErrorBorder: inputBorder(BrandColors.error, 2),
      prefixIconColor: WidgetStateColor.resolveWith(fieldTone),
      suffixIconColor: WidgetStateColor.resolveWith((states) =>
          states.contains(WidgetState.focused) ? accentText : muted),
      labelStyle: TextStyle(color: textSecondary),
      floatingLabelStyle: WidgetStateTextStyle.resolveWith((states) =>
          TextStyle(color: fieldTone(states), fontWeight: FontWeight.w700)),
      hintStyle: TextStyle(color: muted),
      helperStyle: TextStyle(color: muted, height: 1.3),
      errorStyle:
          TextStyle(color: errorInk, fontWeight: FontWeight.w600, height: 1.3),
      errorMaxLines: 3,
    ),
    filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(48, 52)),
      padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 20, vertical: 14)),
      elevation: const WidgetStatePropertyAll(0),
      shape: WidgetStatePropertyAll(rounded),
      textStyle: WidgetStatePropertyAll(
          font.copyWith(fontWeight: FontWeight.w700, fontSize: 15)),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return surfaceSecondary;
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.pressed)) {
          return hover;
        }
        return fill;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.disabled) ? muted : Colors.white),
    )),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.disabled) ? muted : text),
        minimumSize: const WidgetStatePropertyAll(Size(48, 52)),
        padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18, vertical: 14)),
        side: WidgetStateProperty.resolveWith((states) => BorderSide(
            width: 1.5,
            color: states.contains(WidgetState.disabled)
                ? border
                : states.contains(WidgetState.pressed) ||
                        states.contains(WidgetState.focused)
                    ? primary
                    : borderStrong)),
        textStyle:
            WidgetStatePropertyAll(font.copyWith(fontWeight: FontWeight.w700)),
        shape: WidgetStatePropertyAll(rounded),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: accentText,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: font.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48))),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: fill,
        foregroundColor: Colors.white,
        elevation: 0,
        focusElevation: 0,
        hoverElevation: 0,
        highlightElevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
    checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        side: BorderSide(color: muted, width: 1.6),
        fillColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected) ? primary : null),
        checkColor: const WidgetStatePropertyAll(Colors.white)),
    chipTheme: base.chipTheme.copyWith(
        backgroundColor: surfaceSecondary,
        selectedColor: selected,
        side: WidgetStateBorderSide.resolveWith((states) => BorderSide(
            color: states.contains(WidgetState.selected)
                ? primary.withValues(alpha: .7)
                : border)),
        labelStyle:
            font.copyWith(color: textSecondary, fontWeight: FontWeight.w600),
        secondaryLabelStyle:
            font.copyWith(color: text, fontWeight: FontWeight.w800),
        iconTheme: IconThemeData(color: accentText, size: 18),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        shape: const StadiumBorder()),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? Colors.white : muted),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? primary : surfaceSecondary),
      trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? primary : border),
    ),
    sliderTheme: SliderThemeData(
        activeTrackColor: primary,
        inactiveTrackColor: surfaceSecondary,
        thumbColor: primary,
        overlayColor: primary.withValues(alpha: .14),
        trackHeight: 6,
        valueIndicatorColor: dark ? surfaceSecondary : const Color(0xFF15122A),
        valueIndicatorTextStyle: font.copyWith(
            color: dark ? text : Colors.white, fontWeight: FontWeight.w800)),
    progressIndicatorTheme: ProgressIndicatorThemeData(
        color: primary,
        linearTrackColor: surfaceSecondary,
        circularTrackColor: Colors.transparent,
        refreshBackgroundColor: surface),
    bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        modalElevation: 0,
        dragHandleColor: muted.withValues(alpha: .6),
        dragHandleSize: const Size(36, 4),
        showDragHandle: true,
        clipBehavior: Clip.antiAlias,
        constraints: const BoxConstraints(maxWidth: 640),
        shape: RoundedRectangleBorder(
            side: BorderSide(color: border),
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(28)))),
    dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: type.titleLarge?.copyWith(
            color: text,
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3),
        contentTextStyle: type.bodyMedium
            ?.copyWith(color: textSecondary, fontSize: 14.5, height: 1.45),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        shape: RoundedRectangleBorder(
            side: BorderSide(color: border),
            borderRadius: BorderRadius.circular(24))),
    snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        backgroundColor: dark ? surfaceSecondary : const Color(0xFF15122A),
        contentTextStyle: font.copyWith(
            color: dark ? text : Colors.white,
            fontWeight: FontWeight.w600,
            height: 1.35),
        actionTextColor: dark ? secondary : const Color(0xFFB8A9FF),
        shape: RoundedRectangleBorder(
            side: dark ? BorderSide(color: border) : BorderSide.none,
            borderRadius: BorderRadius.circular(14))),
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

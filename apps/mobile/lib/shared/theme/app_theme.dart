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
    'info': Color(0xFF14225B),
    'highlight': Color(0xFF48152B),
  };
}

ThemeData mobileTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final primary = dark ? const Color(0xFF4B40FF) : BrandColors.primary;
  final hover = dark ? const Color(0xFF6259FF) : const Color(0xFF3128D9);
  final secondary = dark ? const Color(0xFF756EFF) : BrandColors.violet;
  final surface = dark ? const Color(0xFF0C152C) : Colors.white;
  final surfaceSecondary =
      dark ? const Color(0xFF121F43) : const Color(0xFFEAEFFD);
  final selected = dark ? const Color(0xFF162467) : const Color(0xFFEAE8FF);
  final text = dark ? const Color(0xFFEFF0F4) : const Color(0xFF070C21);
  final textSecondary =
      dark ? const Color(0xFFBBBFD3) : const Color(0xFF222F64);
  final muted = dark ? const Color(0xFF8F97AF) : const Color(0xFF626A90);
  final border = dark ? const Color(0xFF21305B) : const Color(0xFFD9DFF6);
  final navigationActive = dark ? const Color(0xFF756EFF) : BrandColors.primary;
  final navigationInactive =
      dark ? const Color(0xFF8F97AF) : const Color(0xFF8D99C0);
  final scheme =
      ColorScheme.fromSeed(seedColor: primary, brightness: brightness).copyWith(
    primary: primary,
    onPrimary: Colors.white,
    primaryContainer: selected,
    onPrimaryContainer: text,
    secondary: secondary,
    onSecondary: Colors.white,
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
  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(10),
    borderSide: BorderSide(color: border),
  );
  return base.copyWith(
    scaffoldBackgroundColor:
        dark ? const Color(0xFF050A1A) : const Color(0xFFFBFBFD),
    textTheme: base.textTheme.apply(bodyColor: text, displayColor: text),
    hintColor: muted,
    hoverColor: hover,
    dividerColor: border,
    appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: text,
        surfaceTintColor: Colors.transparent),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: border)),
    ),
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
      shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
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
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xFF081126) : Colors.white,
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

const _monthsShort = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

String _twoDigits(int value) => value.toString().padLeft(2, '0');

/// Formats a cached timestamp in local time for human-friendly offline notices.
String friendlySavedAt(DateTime timestamp) {
  final local = timestamp.toLocal();
  final now = DateTime.now().toLocal();
  final today = DateTime(now.year, now.month, now.day);
  final target = DateTime(local.year, local.month, local.day);
  final time = '${_twoDigits(local.hour)}:${_twoDigits(local.minute)}';
  if (target == today) return 'hoy, $time';
  if (target == today.subtract(const Duration(days: 1))) return 'ayer, $time';
  return '${local.day} ${_monthsShort[local.month - 1]}, $time';
}

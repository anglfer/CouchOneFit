package com.couchonefit.couchonefit_mobile

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

object NotificationBridge {
    @Volatile
    var channel: MethodChannel? = null

    @Volatile
    var isActivityForeground: Boolean = false

    @Volatile
    var pendingLaunchTarget: String? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    fun dispatchWorkoutAction(action: String): Boolean {
        val ch = channel ?: return false
        mainHandler.post {
            ch.invokeMethod("onWorkoutAction", mapOf("action" to action))
        }
        return true
    }

    fun dispatchNavigate(target: String) {
        val ch = channel
        if (ch == null) {
            pendingLaunchTarget = target
            return
        }
        mainHandler.post {
            ch.invokeMethod("onNavigate", mapOf("target" to target))
        }
    }
}

object NotificationHelper {
    const val CHANNEL_WORKOUT_LIVE = "cof_workout_live_v2"
    private const val LEGACY_CHANNEL_WORKOUT_LIVE = "cof_workout_live"
    const val CHANNEL_REST_ALERTS = "cof_rest_alerts"
    const val CHANNEL_MEAL_REMINDERS = "cof_meal_reminders"

    const val WORKOUT_NOTIFICATION_ID = 1001
    const val REST_FINISHED_NOTIFICATION_ID = 1002
    const val REST_FINISHED_ALARM_REQUEST_CODE = 1500
    const val MEAL_ALARM_BASE_REQUEST_CODE = 2000
    const val MAX_MEAL_REMINDERS = 20

    const val ACTION_WORKOUT_CONTROL = "com.couchonefit.couchonefit_mobile.ACTION_WORKOUT_CONTROL"
    const val ACTION_REST_FINISHED = "com.couchonefit.couchonefit_mobile.ACTION_REST_FINISHED"
    const val ACTION_MEAL_REMINDER = "com.couchonefit.couchonefit_mobile.ACTION_MEAL_REMINDER"

    const val EXTRA_ACTION = "action"
    const val EXTRA_MEAL_INDEX = "meal_index"
    const val EXTRA_NAV_TARGET = "cof_nav_target"

    private const val PREFS_WORKOUT = "couchonefit_workout_live"
    private const val PREFS_MEALS = "couchonefit_meal_reminders"
    private const val KEY_PAYLOAD = "payload"
    private const val BRAND_ACCENT = 0xFF7357FF.toInt()

    private fun pendingFlags(): Int =
        PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

    private fun notificationManager(context: Context): NotificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun alarmManager(context: Context): AlarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = notificationManager(context)
        nm.deleteNotificationChannel(LEGACY_CHANNEL_WORKOUT_LIVE)
        val live = NotificationChannel(
            CHANNEL_WORKOUT_LIVE,
            "Entrenamiento activo",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Cronómetro, descanso y controles rápidos durante tu sesión."
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val rest = NotificationChannel(
            CHANNEL_REST_ALERTS,
            "Fin de descanso",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Aviso cuando termina tu temporizador de descanso."
            enableVibration(true)
        }
        val meals = NotificationChannel(
            CHANNEL_MEAL_REMINDERS,
            "Recordatorios de comidas",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Avisos diarios antes de las comidas de tu plan nutricional."
            enableVibration(true)
        }
        nm.createNotificationChannels(listOf(live, rest, meals))
    }

    fun areNotificationsEnabled(context: Context): Boolean {
        val nm = notificationManager(context)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            nm.areNotificationsEnabled()
        } else {
            true
        }
    }

    fun openNotificationSettings(context: Context) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.fromParts("package", context.packageName, null)
            }
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun canScheduleExactAlarms(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(context).canScheduleExactAlarms()

    fun openExactAlarmSettings(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        context.startActivity(
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = android.net.Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }

    fun showWorkoutNotification(context: Context, payload: Map<String, Any?>) {
        ensureChannels(context)
        // Rest ended on its own (not skipped): Dart's timer usually sees it before
        // the inexact alarm, so the alert must come from either path.
        val previous = loadWorkoutState(context)
        val restEndedNaturally = previous != null &&
            previous.optBoolean("restActive", false) &&
            !previous.optBoolean("restPaused", false) &&
            previous.optLong("restEndAtMs", Long.MAX_VALUE) <= System.currentTimeMillis() + 1_000L &&
            payload["restActive"] != true
        saveWorkoutState(context, payload)

        val dayName = (payload["dayName"] as? String)?.ifBlank { "Entrenamiento" } ?: "Entrenamiento"
        val startedAtMs = (payload["startedAtMs"] as? Number)?.toLong() ?: System.currentTimeMillis()
        val completedSets = (payload["completedSets"] as? Number)?.toInt() ?: 0
        val totalSets = ((payload["totalSets"] as? Number)?.toInt() ?: 1).coerceAtLeast(1)
        val exerciseName = payload["exerciseName"] as? String
        val nextSetNumber = (payload["nextSetNumber"] as? Number)?.toInt()
        val exerciseTotalSets = (payload["exerciseTotalSets"] as? Number)?.toInt()
        val nextSetSummary = payload["nextSetSummary"] as? String
        val restActive = payload["restActive"] == true
        val restPaused = payload["restPaused"] == true
        val restEndAtMs = (payload["restEndAtMs"] as? Number)?.toLong()
        val restRemainingSec = ((payload["restRemainingSec"] as? Number)?.toInt() ?: 0).coerceAtLeast(0)
        val haptics = payload["haptics"] != false

        val now = System.currentTimeMillis()
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_WORKOUT_LIVE)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        }

        builder.setSmallIcon(R.drawable.ic_notif_workout)
            .setColor(BRAND_ACCENT)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(launchIntent(context, "workout", 1101))
            .setProgress(totalSets, completedSets.coerceIn(0, totalSets), false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setCategory(Notification.CATEGORY_WORKOUT)
        } else {
            builder.setCategory(Notification.CATEGORY_PROGRESS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
            builder.addExtras(Bundle().apply {
                putBoolean("android.requestPromotedOngoing", true)
            })
            if (restActive && restPaused) {
                builder.setShortCriticalText(formatClock(restRemainingSec))
            } else if (!restActive) {
                builder.setShortCriticalText("$completedSets/$totalSets")
            }
        }

        val nextLabel = buildNextLabel(
            exerciseName = exerciseName,
            nextSetNumber = nextSetNumber,
            exerciseTotalSets = exerciseTotalSets,
            nextSetSummary = nextSetSummary,
            completedSets = completedSets,
            totalSets = totalSets,
            restActive = restActive
        )

        if (restActive) {
            if (!restPaused && restEndAtMs != null && restEndAtMs > now) {
                builder.setUsesChronometer(true)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    builder.setChronometerCountDown(true)
                }
                builder.setWhen(restEndAtMs)
                builder.setShowWhen(true)
                builder.setContentTitle("Descanso · $dayName")
                scheduleRestFinishedAlarm(context, restEndAtMs, haptics)
            } else {
                cancelRestFinishedAlarm(context)
                builder.setUsesChronometer(false)
                builder.setShowWhen(false)
                builder.setContentTitle(
                    if (restPaused) "Descanso en pausa (${formatClock(restRemainingSec)}) · $dayName"
                    else "Descanso · $dayName"
                )
            }

            if (restPaused) {
                addWorkoutAction(context, builder, 1201, "+15 s", "rest_add_15")
                addWorkoutAction(context, builder, 1202, "Reanudar", "rest_toggle_pause")
                addWorkoutAction(context, builder, 1203, "Saltar", "rest_skip")
            } else if (nextSetNumber != null) {
                addWorkoutAction(context, builder, 1201, "+15 s", "rest_add_15")
                addWorkoutAction(context, builder, 1203, "Saltar", "rest_skip")
                addWorkoutAction(context, builder, 1204, "✓ Serie $nextSetNumber", "complete_set")
            } else {
                addWorkoutAction(context, builder, 1205, "−15 s", "rest_sub_15")
                addWorkoutAction(context, builder, 1201, "+15 s", "rest_add_15")
                addWorkoutAction(context, builder, 1203, "Saltar", "rest_skip")
            }
        } else {
            cancelRestFinishedAlarm(context)
            builder.setUsesChronometer(true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                builder.setChronometerCountDown(false)
            }
            builder.setWhen(startedAtMs)
            builder.setShowWhen(true)
            builder.setContentTitle("Entreno activo · $dayName")

            if (nextSetNumber != null) {
                addWorkoutAction(context, builder, 1204, "✓ Serie $nextSetNumber", "complete_set")
                addWorkoutAction(context, builder, 1206, "Descanso", "rest_start")
            }
        }

        val summaryLine = nextLabel.substringBefore("\n")
        builder.setContentText(summaryLine)
        builder.setStyle(Notification.BigTextStyle().bigText(nextLabel))

        try {
            notificationManager(context).notify(WORKOUT_NOTIFICATION_ID, builder.build())
        } catch (_: SecurityException) {
            // El usuario denegó el permiso de notificaciones; no interrumpir la sesión.
        }
        if (restEndedNaturally && !NotificationBridge.isActivityForeground) {
            postRestFinishedAlert(context, exerciseName, nextSetNumber, nextSetSummary, haptics)
        }
    }

    fun cancelWorkoutNotification(context: Context) {
        cancelRestFinishedAlarm(context)
        context.getSharedPreferences(PREFS_WORKOUT, Context.MODE_PRIVATE).edit().clear().apply()
        val nm = notificationManager(context)
        nm.cancel(WORKOUT_NOTIFICATION_ID)
        nm.cancel(REST_FINISHED_NOTIFICATION_ID)
    }

    fun handleRestFinishedAlarm(context: Context) {
        val json = loadWorkoutState(context) ?: return
        if (!json.optBoolean("restActive", false) || json.optBoolean("restPaused", false)) {
            return
        }

        val payload = jsonToMap(json).toMutableMap()
        payload["restActive"] = false
        payload["restPaused"] = false
        payload["restEndAtMs"] = null
        payload["restRemainingSec"] = 0
        showWorkoutNotification(context, payload)
        NotificationBridge.dispatchWorkoutAction("rest_finished")
    }

    private fun postRestFinishedAlert(
        context: Context,
        exerciseName: String?,
        nextSetNumber: Int?,
        nextSetSummary: String?,
        haptics: Boolean
    ) {
        val body = if (!exerciseName.isNullOrBlank() && nextSetNumber != null) {
            "Siguiente: $exerciseName · Serie $nextSetNumber${if (!nextSetSummary.isNullOrBlank()) " ($nextSetSummary)" else ""}"
        } else {
            "¡A por la siguiente serie!"
        }
        val alertBuilder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_REST_ALERTS).setTimeoutAfter(60_000L)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL)
        }
        alertBuilder.setSmallIcon(R.drawable.ic_notif_workout)
            .setColor(BRAND_ACCENT)
            .setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentTitle("Descanso terminado")
            .setContentText(body)
            .setContentIntent(launchIntent(context, "workout", 1102))

        try {
            notificationManager(context).notify(REST_FINISHED_NOTIFICATION_ID, alertBuilder.build())
        } catch (_: SecurityException) {
            /* Sin permiso de notificaciones. */
        }
        if (haptics) vibrateShort(context)
    }

    fun scheduleMealReminders(
        context: Context,
        enabled: Boolean,
        leadMinutes: Int,
        meals: List<Map<String, Any?>>
    ) {
        ensureChannels(context)
        cancelMealAlarmsOnly(context)
        val prefs = context.getSharedPreferences(PREFS_MEALS, Context.MODE_PRIVATE)
        if (!enabled || meals.isEmpty()) {
            prefs.edit().clear().apply()
            return
        }

        val capped = meals.take(MAX_MEAL_REMINDERS)
        val mealsArray = JSONArray()
        for (meal in capped) {
            mealsArray.put(JSONObject().apply {
                put("id", meal["id"] as? String ?: "")
                put("name", meal["name"] as? String ?: "Comida")
                put("scheduleLabel", meal["scheduleLabel"] as? String ?: "")
                put("hour", (meal["hour"] as? Number)?.toInt() ?: 8)
                put("minute", (meal["minute"] as? Number)?.toInt() ?: 0)
                put("preview", meal["preview"] as? String ?: "")
            })
        }
        val stored = JSONObject().apply {
            put("enabled", true)
            put("leadMinutes", leadMinutes)
            put("meals", mealsArray)
        }
        prefs.edit().putString(KEY_PAYLOAD, stored.toString()).apply()

        for (i in 0 until mealsArray.length()) {
            scheduleSingleMealAlarm(context, i, mealsArray.getJSONObject(i), forceTomorrow = false)
        }
    }

    fun rescheduleSavedMealReminders(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_MEALS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PAYLOAD, null) ?: return
        val json = try {
            JSONObject(raw)
        } catch (_: Exception) {
            return
        }
        if (!json.optBoolean("enabled", false)) return
        val meals = json.optJSONArray("meals") ?: return
        ensureChannels(context)
        cancelMealAlarmsOnly(context)
        for (i in 0 until meals.length().coerceAtMost(MAX_MEAL_REMINDERS)) {
            scheduleSingleMealAlarm(context, i, meals.getJSONObject(i), forceTomorrow = false)
        }
    }

    fun handleMealAlarmFired(context: Context, index: Int) {
        val prefs = context.getSharedPreferences(PREFS_MEALS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PAYLOAD, null) ?: return
        val json = try {
            JSONObject(raw)
        } catch (_: Exception) {
            return
        }
        if (!json.optBoolean("enabled", false)) return
        val meals = json.optJSONArray("meals") ?: return
        if (index < 0 || index >= meals.length()) return

        val meal = meals.getJSONObject(index)
        val leadMinutes = json.optInt("leadMinutes", 15).coerceAtLeast(0)
        val name = meal.optString("name", "Comida")
        val scheduleLabel = meal.optString("scheduleLabel", "")
        val preview = meal.optString("preview", "")

        ensureChannels(context)
        val title = if (leadMinutes > 0) {
            if (scheduleLabel.isNotBlank()) "En $leadMinutes min: $name ($scheduleLabel)" else "En $leadMinutes min: $name"
        } else {
            if (scheduleLabel.isNotBlank()) "Hora de comer: $name ($scheduleLabel)" else "Hora de comer: $name"
        }
        val body = if (preview.isNotBlank()) preview else "Consulta tus porciones e indicaciones en CouchOne Fit."

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_MEAL_REMINDERS)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context).setDefaults(Notification.DEFAULT_ALL)
        }
        builder.setSmallIcon(R.drawable.ic_notif_meal)
            .setColor(BRAND_ACCENT)
            .setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(launchIntent(context, "nutrition", MEAL_ALARM_BASE_REQUEST_CODE + index))

        try {
            notificationManager(context).notify(MEAL_ALARM_BASE_REQUEST_CODE + index, builder.build())
        } catch (_: SecurityException) {
            /* Sin permiso de notificaciones. */
        }

        scheduleSingleMealAlarm(context, index, meal, forceTomorrow = true)
    }

    fun cancelMealReminders(context: Context) {
        cancelMealAlarmsOnly(context)
        context.getSharedPreferences(PREFS_MEALS, Context.MODE_PRIVATE).edit().clear().apply()
        val nm = notificationManager(context)
        for (i in 0 until MAX_MEAL_REMINDERS) {
            nm.cancel(MEAL_ALARM_BASE_REQUEST_CODE + i)
        }
    }

    fun cancelAll(context: Context) {
        cancelWorkoutNotification(context)
        cancelMealReminders(context)
    }

    private fun scheduleSingleMealAlarm(
        context: Context,
        index: Int,
        meal: JSONObject,
        forceTomorrow: Boolean
    ) {
        val hour = meal.optInt("hour", -1)
        val minute = meal.optInt("minute", -1)
        if (hour !in 0..23 || minute !in 0..59) return

        val now = System.currentTimeMillis()
        val target = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (forceTomorrow || timeInMillis <= now + 5_000L) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        val intent = Intent(context, MealReminderReceiver::class.java).apply {
            action = ACTION_MEAL_REMINDER
            putExtra(EXTRA_MEAL_INDEX, index)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            MEAL_ALARM_BASE_REQUEST_CODE + index,
            intent,
            pendingFlags()
        )
        scheduleAlarm(alarmManager(context), target.timeInMillis, pi)
    }

    private fun cancelMealAlarmsOnly(context: Context) {
        val am = alarmManager(context)
        for (i in 0 until MAX_MEAL_REMINDERS) {
            val intent = Intent(context, MealReminderReceiver::class.java).apply {
                action = ACTION_MEAL_REMINDER
            }
            val pi = PendingIntent.getBroadcast(
                context,
                MEAL_ALARM_BASE_REQUEST_CODE + i,
                intent,
                pendingFlags()
            )
            am.cancel(pi)
        }
    }

    private fun scheduleRestFinishedAlarm(context: Context, triggerAtMs: Long, haptics: Boolean) {
        val intent = Intent(context, WorkoutNotificationReceiver::class.java).apply {
            action = ACTION_REST_FINISHED
            putExtra("haptics", haptics)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            REST_FINISHED_ALARM_REQUEST_CODE,
            intent,
            pendingFlags()
        )
        scheduleAlarm(alarmManager(context), triggerAtMs, pi)
    }

    private fun cancelRestFinishedAlarm(context: Context) {
        val intent = Intent(context, WorkoutNotificationReceiver::class.java).apply {
            action = ACTION_REST_FINISHED
        }
        val pi = PendingIntent.getBroadcast(
            context,
            REST_FINISHED_ALARM_REQUEST_CODE,
            intent,
            pendingFlags()
        )
        alarmManager(context).cancel(pi)
    }

    // shortcut: without the exact-alarm grant (default on Android 14+) delivery can be ~1 min late;
    // move rest alerts to a foreground service if they must be on time with the process frozen.
    private fun scheduleAlarm(am: AlarmManager, triggerAtMs: Long, pi: PendingIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
        }
    }

    private fun launchIntent(context: Context, target: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_NAV_TARGET, target)
        }
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags())
    }

    private fun addWorkoutAction(
        context: Context,
        builder: Notification.Builder,
        requestCode: Int,
        label: String,
        actionName: String
    ) {
        val intent = Intent(context, WorkoutNotificationReceiver::class.java).apply {
            action = ACTION_WORKOUT_CONTROL
            putExtra(EXTRA_ACTION, actionName)
        }
        val pi = PendingIntent.getBroadcast(context, requestCode, intent, pendingFlags())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val icon = Icon.createWithResource(context, R.drawable.ic_notif_workout)
            builder.addAction(Notification.Action.Builder(icon, label, pi).build())
        } else {
            @Suppress("DEPRECATION")
            builder.addAction(R.drawable.ic_notif_workout, label, pi)
        }
    }

    private fun buildNextLabel(
        exerciseName: String?,
        nextSetNumber: Int?,
        exerciseTotalSets: Int?,
        nextSetSummary: String?,
        completedSets: Int,
        totalSets: Int,
        restActive: Boolean
    ): String {
        val progress = "Progreso: $completedSets/$totalSets series"
        if (exerciseName.isNullOrBlank() || nextSetNumber == null) {
            return if (restActive) {
                "Todas las series registradas ($completedSets/$totalSets) · Toca para finalizar"
            } else {
                "¡Todas las series listas! ($completedSets/$totalSets) · Toca para finalizar"
            }
        }
        val setPart = if (exerciseTotalSets != null && !restActive) {
            "Serie $nextSetNumber de $exerciseTotalSets"
        } else {
            "Serie $nextSetNumber"
        }
        val prefix = if (restActive) "Siguiente: " else ""
        val detail = if (!nextSetSummary.isNullOrBlank()) " ($nextSetSummary)" else ""
        return "$prefix$exerciseName · $setPart$detail\n$progress"
    }

    private fun formatClock(seconds: Int): String {
        val m = seconds / 60
        val s = seconds % 60
        return "$m:${s.toString().padStart(2, '0')}"
    }

    private fun saveWorkoutState(context: Context, payload: Map<String, Any?>) {
        val json = JSONObject()
        for ((k, v) in payload) {
            json.put(k, v ?: JSONObject.NULL)
        }
        context.getSharedPreferences(PREFS_WORKOUT, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PAYLOAD, json.toString())
            .apply()
    }

    private fun loadWorkoutState(context: Context): JSONObject? {
        val raw = context.getSharedPreferences(PREFS_WORKOUT, Context.MODE_PRIVATE)
            .getString(KEY_PAYLOAD, null) ?: return null
        return try {
            JSONObject(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun jsonToMap(json: JSONObject): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            val v = json.get(k)
            map[k] = if (v === JSONObject.NULL) null else v
        }
        return map
    }

    private fun vibrateShort(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(250, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(
                        VibrationEffect.createOneShot(250, VibrationEffect.DEFAULT_AMPLITUDE)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(250)
                }
            }
        } catch (_: Exception) {
            /* Vibrador no disponible. */
        }
    }
}

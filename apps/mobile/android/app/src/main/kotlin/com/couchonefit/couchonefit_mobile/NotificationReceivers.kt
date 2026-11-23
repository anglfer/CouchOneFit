package com.couchonefit.couchonefit_mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WorkoutNotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            NotificationHelper.ACTION_REST_FINISHED -> {
                NotificationHelper.handleRestFinishedAlarm(context)
            }
            NotificationHelper.ACTION_WORKOUT_CONTROL -> {
                val action = intent.getStringExtra(NotificationHelper.EXTRA_ACTION) ?: return
                val delivered = NotificationBridge.dispatchWorkoutAction(action)
                if (!delivered) {
                    val launch = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra(NotificationHelper.EXTRA_NAV_TARGET, "workout")
                    }
                    context.startActivity(launch)
                }
            }
        }
    }
}

class MealReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != NotificationHelper.ACTION_MEAL_REMINDER) return
        val index = intent.getIntExtra(NotificationHelper.EXTRA_MEAL_INDEX, -1)
        if (index >= 0) {
            NotificationHelper.handleMealAlarmFired(context, index)
        }
    }
}

class NotificationBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> {
                NotificationHelper.rescheduleSavedMealReminders(context)
            }
        }
    }
}

package com.couchonefit.couchonefit_mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MainActivity : FlutterActivity() {
    private val alias = "couchonefit_session_key"
    private var pendingPermissionResult: MethodChannel.Result? = null

    companion object {
        private const val NOTIF_PERM_REQUEST_CODE = 4041
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleNavIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNavIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        NotificationBridge.isActivityForeground = true
    }

    override fun onPause() {
        NotificationBridge.isActivityForeground = false
        super.onPause()
    }

    private fun handleNavIntent(intent: Intent?) {
        val target = intent?.getStringExtra(NotificationHelper.EXTRA_NAV_TARGET)
        if (!target.isNullOrBlank()) {
            intent.removeExtra(NotificationHelper.EXTRA_NAV_TARGET)
            NotificationBridge.dispatchNavigate(target)
        }
    }

    private fun sessionKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build())
        }.generateKey()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        NotificationHelper.ensureChannels(this)
        val notifChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "couchonefit/notifications")
        NotificationBridge.channel = notifChannel
        notifChannel.setMethodCallHandler { call, result ->
            when (call.method) {
                "requestPermission" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        pendingPermissionResult?.success(false)
                        pendingPermissionResult = result
                        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIF_PERM_REQUEST_CODE)
                    } else {
                        result.success(NotificationHelper.areNotificationsEnabled(this))
                    }
                }
                "areEnabled" -> {
                    result.success(NotificationHelper.areNotificationsEnabled(this))
                }
                "openSettings" -> {
                    NotificationHelper.openNotificationSettings(this)
                    result.success(null)
                }
                "canScheduleExactAlarms" -> {
                    result.success(NotificationHelper.canScheduleExactAlarms(this))
                }
                "openExactAlarmSettings" -> {
                    NotificationHelper.openExactAlarmSettings(this)
                    result.success(null)
                }
                "showWorkoutNotification" -> {
                    val args = call.arguments as? Map<String, Any?> ?: emptyMap()
                    NotificationHelper.showWorkoutNotification(this, args)
                    result.success(null)
                }
                "cancelWorkoutNotification" -> {
                    NotificationHelper.cancelWorkoutNotification(this)
                    result.success(null)
                }
                "scheduleMealReminders" -> {
                    val args = call.arguments as? Map<String, Any?> ?: emptyMap()
                    val enabled = args["enabled"] == true
                    val leadMinutes = (args["leadMinutes"] as? Number)?.toInt() ?: 15
                    @Suppress("UNCHECKED_CAST")
                    val meals = (args["meals"] as? List<Map<String, Any?>>) ?: emptyList()
                    NotificationHelper.scheduleMealReminders(this, enabled, leadMinutes, meals)
                    result.success(null)
                }
                "cancelMealReminders" -> {
                    NotificationHelper.cancelMealReminders(this)
                    result.success(null)
                }
                "cancelAll" -> {
                    NotificationHelper.cancelAll(this)
                    result.success(null)
                }
                "consumePendingLaunchTarget" -> {
                    val pending = NotificationBridge.pendingLaunchTarget
                    NotificationBridge.pendingLaunchTarget = null
                    result.success(pending)
                }
                else -> result.notImplemented()
            }
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "couchonefit/secure_session").setMethodCallHandler { call, result ->
            val cache = call.argument<String>("key") == "cof_client_training_cache"
            val file = when (call.argument<String>("key")) {
                "cof_client_session" -> "couchonefit_secure_session"
                "cof_client_training_cache" -> "couchonefit_training_cache"
                "cof_app_settings" -> "couchonefit_app_settings"
                else -> {
                    result.error("INVALID_STORAGE_KEY", "La sesión no está disponible.", null)
                    return@setMethodCallHandler
                }
            }
            val preferences = getSharedPreferences(file, MODE_PRIVATE)
            try {
                when (call.method) {
                    "read" -> {
                        val encrypted = preferences.getString("payload", null)
                        val iv = preferences.getString("iv", null)
                        if (encrypted == null || iv == null) {
                            result.success(null)
                        } else {
                            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                            cipher.init(Cipher.DECRYPT_MODE, sessionKey(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
                            result.success(String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), Charsets.UTF_8))
                        }
                    }
                    "write" -> {
                        val value = call.argument<String>("value")
                        if (value == null || value.length > (if (cache) 2097152 else 16384)) {
                            result.error("INVALID_SESSION", "La sesión no tiene un formato válido.", null)
                        } else {
                            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                            cipher.init(Cipher.ENCRYPT_MODE, sessionKey())
                            val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
                            check(preferences.edit()
                                .putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                                .putString("payload", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                                .commit())
                            result.success(null)
                        }
                    }
                    "delete" -> {
                        check(preferences.edit().clear().commit())
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            } catch (_: Exception) {
                // A restored backup or invalidated key must never resurrect a session.
                preferences.edit().clear().commit()
                result.error("SECURE_STORAGE_UNAVAILABLE", "No pudimos acceder al almacenamiento seguro de la sesión.", null)
            }
        }
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        NotificationBridge.channel = null
        super.cleanUpFlutterEngine(flutterEngine)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == NOTIF_PERM_REQUEST_CODE) {
            pendingPermissionResult?.success(NotificationHelper.areNotificationsEnabled(this))
            pendingPermissionResult = null
        }
    }
}

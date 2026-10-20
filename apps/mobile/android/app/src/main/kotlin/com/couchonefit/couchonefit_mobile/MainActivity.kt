package com.couchonefit.couchonefit_mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
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
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "couchonefit/secure_session").setMethodCallHandler { call, result ->
            if (call.argument<String>("key") != "cof_client_session") {
                result.error("INVALID_STORAGE_KEY", "La sesión no está disponible.", null)
                return@setMethodCallHandler
            }
            val preferences = getSharedPreferences("couchonefit_secure_session", MODE_PRIVATE)
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
                        if (value == null || value.length > 16384) {
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
}

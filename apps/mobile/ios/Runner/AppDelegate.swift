import Flutter
import UIKit
import Security

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(name: "couchonefit/secure_session", binaryMessenger: engineBridge.applicationRegistrar.messenger())
    channel.setMethodCallHandler { call, result in
      guard let args = call.arguments as? [String: Any], let key = args["key"] as? String,
            ["cof_client_session", "cof_client_training_cache"].contains(key) else {
        result(FlutterError(code: "INVALID_STORAGE_KEY", message: "Almacenamiento no disponible.", details: nil)); return
      }
      let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.couchonefit.secure", kSecAttrAccount as String: key]
      var status: OSStatus = errSecSuccess
      switch call.method {
      case "read":
        var read = query
        read[kSecReturnData as String] = true
        read[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        status = SecItemCopyMatching(read as CFDictionary, &item)
        if status == errSecItemNotFound { result(nil); return }
        if status == errSecSuccess, let data = item as? Data { result(String(data: data, encoding: .utf8)); return }
      case "write":
        guard let value = args["value"] as? String, let data = value.data(using: .utf8),
              data.count <= (key == "cof_client_session" ? 16384 : 2097152) else {
          result(FlutterError(code: "INVALID_SESSION", message: "Datos inválidos.", details: nil)); return
        }
        let attributes: [String: Any] = [kSecValueData as String: data,
          kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
          status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
      case "delete":
        status = SecItemDelete(query as CFDictionary)
        if status == errSecItemNotFound { status = errSecSuccess }
      default: result(FlutterMethodNotImplemented); return
      }
      if status == errSecSuccess { result(nil) }
      else { result(FlutterError(code: "SECURE_STORAGE_UNAVAILABLE", message: "No pudimos acceder al almacenamiento seguro.", details: nil)) }
    }
  }
}

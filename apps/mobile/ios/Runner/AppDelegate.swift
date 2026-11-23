import Flutter
import UIKit
import Security
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var notificationChannel: FlutterMethodChannel?
  private var pendingLaunchTarget: String?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    if let target = userInfo["target"] as? String {
      if let ch = notificationChannel {
        ch.invokeMethod("onNavigate", arguments: ["target": target])
      } else {
        pendingLaunchTarget = target
      }
    }
    completionHandler()
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let notifChannel = FlutterMethodChannel(
      name: "couchonefit/notifications",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    notificationChannel = notifChannel
    notifChannel.setMethodCallHandler { [weak self] call, result in
      let center = UNUserNotificationCenter.current()
      switch call.method {
      case "requestPermission":
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
          DispatchQueue.main.async { result(granted) }
        }
      case "areEnabled":
        center.getNotificationSettings { settings in
          let ok = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
          DispatchQueue.main.async { result(ok) }
        }
      case "openSettings":
        if let url = URL(string: UIApplication.openSettingsURLString) {
          DispatchQueue.main.async {
            UIApplication.shared.open(url)
            result(nil)
          }
        } else {
          result(nil)
        }
      case "showWorkoutNotification":
        center.removePendingNotificationRequests(withIdentifiers: ["cof_rest_finished"])
        guard let args = call.arguments as? [String: Any],
              args["restActive"] as? Bool == true,
              args["restPaused"] as? Bool != true,
              let restEndMs = args["restEndAtMs"] as? NSNumber else {
          result(nil)
          return
        }
        let delay = max(1.0, (restEndMs.doubleValue - Date().timeIntervalSince1970 * 1000.0) / 1000.0)
        let content = UNMutableNotificationContent()
        content.title = "Descanso terminado"
        if let ex = args["exerciseName"] as? String, let setNum = args["nextSetNumber"] as? NSNumber {
          content.body = "Siguiente: \(ex) · Serie \(setNum)"
        } else {
          content.body = "¡A por la siguiente serie!"
        }
        content.sound = .default
        content.userInfo = ["target": "workout"]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
        let req = UNNotificationRequest(identifier: "cof_rest_finished", content: content, trigger: trigger)
        center.add(req) { _ in DispatchQueue.main.async { result(nil) } }
      case "cancelWorkoutNotification":
        center.removePendingNotificationRequests(withIdentifiers: ["cof_rest_finished"])
        center.removeDeliveredNotifications(withIdentifiers: ["cof_rest_finished"])
        result(nil)
      case "scheduleMealReminders":
        center.getPendingNotificationRequests { requests in
          let oldIds = requests.map(\.identifier).filter { $0.hasPrefix("cof_meal_") }
          center.removePendingNotificationRequests(withIdentifiers: oldIds)
          guard let args = call.arguments as? [String: Any],
                args["enabled"] as? Bool == true,
                let meals = args["meals"] as? [[String: Any]], !meals.isEmpty else {
            DispatchQueue.main.async { result(nil) }
            return
          }
          let lead = (args["leadMinutes"] as? NSNumber)?.intValue ?? 15
          for (idx, meal) in meals.prefix(20).enumerated() {
            guard let hour = (meal["hour"] as? NSNumber)?.intValue,
                  let minute = (meal["minute"] as? NSNumber)?.intValue else { continue }
            let name = meal["name"] as? String ?? "Comida"
            let label = meal["scheduleLabel"] as? String ?? ""
            let preview = meal["preview"] as? String ?? ""
            let content = UNMutableNotificationContent()
            content.title = lead > 0
              ? (label.isEmpty ? "En \(lead) min: \(name)" : "En \(lead) min: \(name) (\(label))")
              : (label.isEmpty ? "Hora de comer: \(name)" : "Hora de comer: \(name) (\(label))")
            content.body = preview.isEmpty ? "Consulta tu plan nutricional en CouchOne Fit." : preview
            content.sound = .default
            content.userInfo = ["target": "nutrition"]
            var comps = DateComponents()
            comps.hour = hour
            comps.minute = minute
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
            let req = UNNotificationRequest(identifier: "cof_meal_\(idx)", content: content, trigger: trigger)
            center.add(req)
          }
          DispatchQueue.main.async { result(nil) }
        }
      case "cancelMealReminders":
        center.getPendingNotificationRequests { requests in
          let oldIds = requests.map(\.identifier).filter { $0.hasPrefix("cof_meal_") }
          center.removePendingNotificationRequests(withIdentifiers: oldIds)
          DispatchQueue.main.async { result(nil) }
        }
      case "cancelAll":
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        result(nil)
      case "consumePendingLaunchTarget":
        let pending = self?.pendingLaunchTarget
        self?.pendingLaunchTarget = nil
        result(pending)
      default:
        result(FlutterMethodNotImplemented)
      }
    }

    let channel = FlutterMethodChannel(name: "couchonefit/secure_session", binaryMessenger: engineBridge.applicationRegistrar.messenger())
    channel.setMethodCallHandler { call, result in
      guard let args = call.arguments as? [String: Any], let key = args["key"] as? String,
            ["cof_client_session", "cof_client_training_cache", "cof_app_settings"].contains(key) else {
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

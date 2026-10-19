import 'package:couchonefit_mobile/shared/services/api_config.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class EnvironmentBundle extends CachingAssetBundle {
  EnvironmentBundle(this.source);
  final String source;

  @override
  Future<String> loadString(String key, {bool cache = true}) async {
    expect(key, '.env.json');
    return source;
  }

  @override
  Future<ByteData> load(String key) => throw UnimplementedError();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the environment file is bundled and readable at startup', () async {
    await ApiConfig.load();
    expect(Uri.parse(ApiConfig.baseUrl).host, isNotEmpty);
  });

  test('loads API URL from the environment file without command arguments',
      () async {
    await ApiConfig.load(
      bundle:
          EnvironmentBundle('{"API_BASE_URL":" https://api.example.com/ "}'),
    );
    expect(ApiConfig.baseUrl, 'https://api.example.com');
    expect(ApiConfig.healthEndpoint, 'https://api.example.com/api/health');
  });

  test('rejects missing or malformed API URLs before starting the app',
      () async {
    for (final source in [
      '{}',
      '{"API_BASE_URL":123}',
      '{"API_BASE_URL":""}',
      '{"API_BASE_URL":"api.example.com"}',
      '{"API_BASE_URL":"file:///tmp/api"}',
      '{"API_BASE_URL":"https://user:password@example.com"}',
      '{"API_BASE_URL":"https://example.com?key=value"}',
      'not json',
    ]) {
      await expectLater(
        ApiConfig.load(bundle: EnvironmentBundle(source)),
        throwsFormatException,
      );
    }
  });
}

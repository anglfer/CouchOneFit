import 'package:flutter_test/flutter_test.dart';
import 'package:couchonefit_mobile/main.dart';

void main() {
  testWidgets('CouchOneFitApp smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const CouchOneFitApp());

    // Verify that the title text is rendered.
    expect(find.text('CouchOne Fit - Móvil'), findsOneWidget);
  });
}

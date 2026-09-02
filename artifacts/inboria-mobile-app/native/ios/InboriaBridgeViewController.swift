import Capacitor

final class InboriaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(InboriaNativePlugin())
    }
}
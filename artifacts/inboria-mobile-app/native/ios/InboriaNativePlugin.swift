import Capacitor
import LocalAuthentication
import UIKit
import VisionKit

@objc(InboriaNativePlugin)
public final class InboriaNativePlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "InboriaNativePlugin"
    public let jsName = "InboriaNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanDocument", returnType: CAPPluginReturnPromise)
    ]

    private var scanCall: CAPPluginCall?

    @objc func authenticate(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            call.resolve(["available": false, "success": true])
            return
        }

        let reason = call.getString("reason") ?? "Déverrouiller Inboria"
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["available": true, "success": true])
                } else {
                    call.resolve([
                        "available": true,
                        "success": false,
                        "message": authError?.localizedDescription ?? "Authentification refusée"
                    ])
                }
            }
        }
    }

    @objc func scanDocument(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("Scanner indisponible sur cet appareil", "SCANNER_UNAVAILABLE")
            return
        }
        guard scanCall == nil else {
            call.reject("Un scan est déjà en cours", "SCANNER_BUSY")
            return
        }

        scanCall = call
        DispatchQueue.main.async {
            let scanner = VNDocumentCameraViewController()
            scanner.delegate = self
            scanner.modalPresentationStyle = .fullScreen
            self.bridge?.viewController?.present(scanner, animated: true)
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        scanCall?.reject("Scan annulé", "SCAN_CANCELLED")
        scanCall = nil
    }

    public func documentCameraViewController(
        _ controller: VNDocumentCameraViewController,
        didFailWithError error: Error
    ) {
        controller.dismiss(animated: true)
        scanCall?.reject(error.localizedDescription, "SCAN_FAILED")
        scanCall = nil
    }

    public func documentCameraViewController(
        _ controller: VNDocumentCameraViewController,
        didFinishWith scan: VNDocumentCameraScan
    ) {
        controller.dismiss(animated: true)
        guard let call = scanCall else { return }
        scanCall = nil

        let pdfData = NSMutableData()
        UIGraphicsBeginPDFContextToData(pdfData, .zero, nil)
        for page in 0..<scan.pageCount {
            let image = scan.imageOfPage(at: page)
            let bounds = CGRect(origin: .zero, size: image.size)
            UIGraphicsBeginPDFPageWithInfo(bounds, nil)
            image.draw(in: bounds)
        }
        UIGraphicsEndPDFContext()

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd-HHmmss"
        let filename = "Scan-Inboria-\(formatter.string(from: Date())).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        do {
            try (pdfData as Data).write(to: url, options: .atomic)
            call.resolve([
                "path": url.absoluteString,
                "name": filename,
                "mimeType": "application/pdf",
                "size": pdfData.length,
                "pageCount": scan.pageCount
            ])
        } catch {
            call.reject(error.localizedDescription, "SCAN_WRITE_FAILED")
        }
    }
}
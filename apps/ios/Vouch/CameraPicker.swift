import SwiftUI
import UIKit

struct CameraPicker: UIViewControllerRepresentable {
  var onImage: (UIImage?) -> Void

  func makeUIViewController(context: Context) -> UIImagePickerController {
    let picker = UIImagePickerController()
    picker.sourceType = .camera
    picker.delegate = context.coordinator
    picker.allowsEditing = false
    return picker
  }

  func updateUIViewController(_: UIImagePickerController, context _: Context) {}

  func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage) }

  final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
    var onImage: (UIImage?) -> Void
    init(onImage: @escaping (UIImage?) -> Void) { self.onImage = onImage }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
      onImage(nil)
    }

    func imagePickerController(
      _: UIImagePickerController,
      didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
      onImage(info[.originalImage] as? UIImage)
    }
  }
}

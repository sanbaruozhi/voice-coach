import AVFoundation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct LegacyPHPickerView: UIViewControllerRepresentable {
    let completion: (Result<ReferenceMedia, Error>) -> Void

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .any(of: [.images, .videos])
        configuration.selectionLimit = 1

        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(completion: completion)
    }

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let completion: (Result<ReferenceMedia, Error>) -> Void

        init(completion: @escaping (Result<ReferenceMedia, Error>) -> Void) {
            self.completion = completion
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)

            guard let provider = results.first?.itemProvider else { return }

            if provider.canLoadObject(ofClass: UIImage.self) {
                provider.loadObject(ofClass: UIImage.self) { object, error in
                    DispatchQueue.main.async {
                        if let error {
                            self.completion(.failure(error))
                        } else if let image = object as? UIImage {
                            self.completion(.success(.image(image)))
                        } else {
                            self.completion(.failure(ReferenceMediaPickerError.imageLoadFailed))
                        }
                    }
                }
                return
            }

            let videoTypeIdentifier = provider.registeredTypeIdentifiers.first { identifier in
                guard let type = UTType(identifier) else { return false }
                return type.conforms(to: .movie) || type.conforms(to: .video) || type.conforms(to: .audiovisualContent)
            }

            guard let videoTypeIdentifier else {
                completion(.failure(ReferenceMediaPickerError.unsupportedMedia))
                return
            }

            provider.loadFileRepresentation(forTypeIdentifier: videoTypeIdentifier) { temporaryURL, error in
                if let error {
                    DispatchQueue.main.async {
                        self.completion(.failure(error))
                    }
                    return
                }

                guard let temporaryURL else {
                    DispatchQueue.main.async {
                        self.completion(.failure(ReferenceMediaPickerError.videoLoadFailed))
                    }
                    return
                }

                do {
                    let copiedURL = try TempFileStore.copyTemporaryFile(from: temporaryURL, suggestedExtension: "mov")
                    let player = AVPlayer(url: copiedURL)
                    DispatchQueue.main.async {
                        self.completion(.success(ReferenceMedia.makeVideo(url: copiedURL, player: player)))
                    }
                } catch {
                    DispatchQueue.main.async {
                        self.completion(.failure(error))
                    }
                }
            }
        }
    }
}

enum ReferenceMediaPickerError: LocalizedError {
    case unsupportedMedia
    case imageLoadFailed
    case videoLoadFailed

    var errorDescription: String? {
        switch self {
        case .unsupportedMedia:
            return "请选择图片或视频"
        case .imageLoadFailed:
            return "图片加载失败"
        case .videoLoadFailed:
            return "视频加载失败"
        }
    }
}

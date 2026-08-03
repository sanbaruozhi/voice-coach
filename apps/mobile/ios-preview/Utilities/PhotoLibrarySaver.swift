import Foundation
import Photos

final class PhotoLibrarySaver {
    static func saveVideoToLibrary(_ url: URL, completion: @escaping (Result<Void, Error>) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async {
                    completion(.failure(PhotoLibraryError.addOnlyPermissionDenied))
                }
                return
            }

            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
            } completionHandler: { success, error in
                DispatchQueue.main.async {
                    if let error {
                        completion(.failure(error))
                    } else if success {
                        completion(.success(()))
                    } else {
                        completion(.failure(PhotoLibraryError.saveFailedWithoutError))
                    }
                }
            }
        }
    }
}

enum PhotoLibraryError: LocalizedError {
    case addOnlyPermissionDenied
    case saveFailedWithoutError

    var errorDescription: String? {
        switch self {
        case .addOnlyPermissionDenied:
            return "未获得相册写入权限"
        case .saveFailedWithoutError:
            return "保存到相册失败"
        }
    }
}

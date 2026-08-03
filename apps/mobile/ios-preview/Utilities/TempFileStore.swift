import Foundation
import UniformTypeIdentifiers

enum TempFileStore {
    private static let directoryName = "UltimateCameraAppTemp"

    static var directoryURL: URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(directoryName, isDirectory: true)
        if !FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }

    static func makeMovieURL(fileExtension: String = "mov") -> URL {
        directoryURL.appendingPathComponent(UUID().uuidString).appendingPathExtension(fileExtension)
    }

    static func copyTemporaryFile(from sourceURL: URL, suggestedExtension: String = "mov") throws -> URL {
        let pathExtension = sourceURL.pathExtension.isEmpty ? suggestedExtension : sourceURL.pathExtension
        let destinationURL = makeMovieURL(fileExtension: pathExtension)
        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
        }
        try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
        return destinationURL
    }

    static func removeFile(at url: URL) {
        try? FileManager.default.removeItem(at: url)
    }
}

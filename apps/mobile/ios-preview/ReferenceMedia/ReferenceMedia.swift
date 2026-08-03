import AVFoundation
import UIKit

enum ReferenceMediaDisplayOrientation {
    case portrait
    case landscape
}

enum ReferenceMedia {
    case image(UIImage)
    case video(url: URL, player: AVPlayer, orientation: ReferenceMediaDisplayOrientation)

    var displayOrientation: ReferenceMediaDisplayOrientation {
        switch self {
        case let .image(image):
            return image.size.width > image.size.height ? .landscape : .portrait
        case let .video(_, _, orientation):
            return orientation
        }
    }

    static func makeVideo(url: URL, player: AVPlayer) -> ReferenceMedia {
        player.isMuted = true
        player.volume = 0
        return .video(url: url, player: player, orientation: detectVideoOrientation(url: url))
    }

    private static func detectVideoOrientation(url: URL) -> ReferenceMediaDisplayOrientation {
        let asset = AVAsset(url: url)
        guard let track = asset.tracks(withMediaType: .video).first else {
            return .portrait
        }

        let transformedSize = track.naturalSize.applying(track.preferredTransform)
        return abs(transformedSize.width) > abs(transformedSize.height) ? .landscape : .portrait
    }
}

import Foundation

enum CameraError: LocalizedError {
    case cameraPermissionDenied
    case microphonePermissionDenied
    case audioSessionConfigurationFailed(Error)
    case videoDeviceUnavailable
    case audioDeviceUnavailable
    case unsupportedRequiredFormat
    case unsupportedFrontRequiredFormat
    case unsupportedDolbyVisionOutput
    case configurationFailed(Error)
    case recordingFailed(Error)
    case savingFailed(Error)

    var errorDescription: String? {
        switch self {
        case .cameraPermissionDenied:
            return "未获得相机权限"
        case .microphonePermissionDenied:
            return "未获得麦克风权限"
        case let .audioSessionConfigurationFailed(error):
            return "音频会话配置失败：\(error.localizedDescription)"
        case .videoDeviceUnavailable:
            return "未找到可用后置摄像头"
        case .audioDeviceUnavailable:
            return "未找到可用麦克风"
        case .unsupportedRequiredFormat:
            return "当前设备不支持 4K 录像格式"
        case .unsupportedFrontRequiredFormat:
            return "当前前置摄像头不支持 4K 录像格式"
        case .unsupportedDolbyVisionOutput:
            return "当前录像输出不支持高效视频编码"
        case let .configurationFailed(error):
            return "相机配置失败：\(error.localizedDescription)"
        case let .recordingFailed(error):
            return "录像失败：\(error.localizedDescription)"
        case let .savingFailed(error):
            return "保存到相册失败：\(error.localizedDescription)"
        }
    }
}

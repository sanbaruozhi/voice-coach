import AVFoundation
import CoreMedia
import Foundation
import UIKit
import VideoToolbox

final class CameraManager: NSObject, ObservableObject, AVCaptureFileOutputRecordingDelegate {
    let session = AVCaptureSession()

    @Published private(set) var isConfigured = false
    @Published private(set) var isRecording = false
    @Published private(set) var cameraPosition: AVCaptureDevice.Position = .back
    @Published private(set) var captureSummary = ""
    @Published var errorMessage: String?

    var onRecordingStarted: (() -> Void)?
    var onRecordingFinished: ((URL) -> Void)?

    private let sessionQueue = DispatchQueue(label: "ultimate.camera.session.queue")
    private let movieOutput = AVCaptureMovieFileOutput()
    private var activeVideoDevice: AVCaptureDevice?
    private var selectedCameraPosition: AVCaptureDevice.Position = .back
    private var recordingVideoOrientation: AVCaptureVideoOrientation = .portrait
    private var currentRecordingURL: URL?
    private var isConfiguring = false
    private var isPreparingToRecord = false
    private var activeCaptureProfile: CaptureProfile?
    private var activeCaptureEnvironment: CaptureEnvironment = .normal
    private var recordingAdaptationTimer: DispatchSourceTimer?
    private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid

    private enum CaptureEnvironment {
        case bright
        case normal
        case lowLight
    }

    private struct CaptureProfile {
        let format: AVCaptureDevice.Format
        let frameRate: Int32
    }

    func configureSession() {
        sessionQueue.async {
            guard !self.isConfigured, !self.isConfiguring else { return }
            self.isConfiguring = true
            self.requestCapturePermissions { granted in
                self.sessionQueue.async {
                    guard granted else {
                        self.isConfiguring = false
                        return
                    }

                    do {
                        try self.configureSessionOnQueue(position: self.selectedCameraPosition)
                    } catch let cameraError as CameraError {
                        self.publishError(cameraError)
                    } catch {
                        self.publishError(.configurationFailed(error))
                    }

                    self.isConfiguring = false
                }
            }
        }
    }

    func stopSession() {
        sessionQueue.async {
            guard !self.movieOutput.isRecording else {
                self.debugLog("stopSession ignored while movie output is recording")
                return
            }

            if self.session.isRunning {
                self.session.stopRunning()
            }
            self.stopRealtimeCaptureMonitoring()
        }
    }

    func switchCamera() {
        sessionQueue.async {
            guard !self.movieOutput.isRecording, !self.isConfiguring else { return }
            let targetPosition: AVCaptureDevice.Position = self.selectedCameraPosition == .back ? .front : .back
            self.reconfigureSession(for: targetPosition)
        }
    }

    func setRecordingVideoOrientation(_ orientation: AVCaptureVideoOrientation) {
        sessionQueue.async {
            self.recordingVideoOrientation = orientation
            if let connection = self.movieOutput.connection(with: .video) {
                self.configureConnectionForRecording(connection, position: self.selectedCameraPosition)
            }
        }
    }

    func startRecording(videoOrientation: AVCaptureVideoOrientation) {
        sessionQueue.async {
            guard self.isConfigured else {
                self.publishError(.unsupportedRequiredFormat)
                return
            }
            guard !self.movieOutput.isRecording, !self.isPreparingToRecord else { return }

            self.isPreparingToRecord = true
            self.recordingVideoOrientation = videoOrientation
            self.refocusAndExposeAtCenter(reason: "pre-recording")

            self.sessionQueue.asyncAfter(deadline: .now() + 0.35) {
                self.prepareAndStartRecording(videoOrientation: videoOrientation)
            }
        }
    }

    func stopRecording() {
        sessionQueue.async {
            self.isPreparingToRecord = false
            self.stopRealtimeCaptureMonitoring()
            guard self.movieOutput.isRecording else { return }
            self.movieOutput.stopRecording()
        }
    }

    private func requestCapturePermissions(completion: @escaping (Bool) -> Void) {
        requestAccess(for: .video, deniedError: .cameraPermissionDenied) { videoGranted in
            guard videoGranted else {
                completion(false)
                return
            }

            self.requestAccess(for: .audio, deniedError: .microphonePermissionDenied) { audioGranted in
                completion(audioGranted)
            }
        }
    }

    private func requestAccess(for mediaType: AVMediaType, deniedError: CameraError, completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: mediaType) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: mediaType) { granted in
                if !granted {
                    self.publishError(deniedError)
                }
                completion(granted)
            }
        case .denied, .restricted:
            publishError(deniedError)
            completion(false)
        @unknown default:
            publishError(deniedError)
            completion(false)
        }
    }

    private func reconfigureSession(for position: AVCaptureDevice.Position) {
        isConfiguring = true
        DispatchQueue.main.async {
            self.isConfigured = false
            self.captureSummary = ""
            self.errorMessage = nil
        }

        do {
            try configureSessionOnQueue(position: position)
        } catch let cameraError as CameraError {
            publishError(cameraError)
        } catch {
            publishError(.configurationFailed(error))
        }

        isConfiguring = false
    }

    private func configureSessionOnQueue(position: AVCaptureDevice.Position) throws {
        try configureAudioSession()

        if session.isRunning {
            session.stopRunning()
        }

        session.beginConfiguration()
        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }
        session.automaticallyConfiguresCaptureDeviceForWideColor = true

        if session.canSetSessionPreset(.inputPriority) {
            session.sessionPreset = .inputPriority
        }

        let selectedDevice = try selectBestVideoDevice(position: position)
        let environment: CaptureEnvironment = .normal
        guard let selectedProfile = findClearestCaptureProfile(for: selectedDevice, environment: environment) else {
            logClosestFormats(for: selectedDevice)
            session.commitConfiguration()
            throw position == .front ? CameraError.unsupportedFrontRequiredFormat : CameraError.unsupportedRequiredFormat
        }

        try configureVideoDevice(selectedDevice, selectedProfile: selectedProfile, environment: environment)

        let videoInput = try AVCaptureDeviceInput(device: selectedDevice)
        guard session.canAddInput(videoInput) else {
            session.commitConfiguration()
            throw CameraError.videoDeviceUnavailable
        }
        session.addInput(videoInput)

        guard let audioDevice = preferredAudioDevice() else {
            session.commitConfiguration()
            throw CameraError.audioDeviceUnavailable
        }

        let audioInput = try AVCaptureDeviceInput(device: audioDevice)
        guard session.canAddInput(audioInput) else {
            session.commitConfiguration()
            throw CameraError.audioDeviceUnavailable
        }
        session.addInput(audioInput)

        guard session.canAddOutput(movieOutput) else {
            session.commitConfiguration()
            throw CameraError.configurationFailed(CameraSetupError.cannotAddMovieOutput)
        }
        session.addOutput(movieOutput)

        if let connection = movieOutput.connection(with: .video) {
            configureConnectionForRecording(connection, position: position)
            try configureMovieCodec(for: connection, position: position, profile: selectedProfile, environment: environment)
        }

        activeVideoDevice = selectedDevice
        selectedCameraPosition = position
        activeCaptureProfile = selectedProfile
        activeCaptureEnvironment = environment
        let activeCaptureSummary = captureSummary(position: position, profile: selectedProfile)
        logSelectedConfiguration(device: selectedDevice, profile: selectedProfile)

        session.commitConfiguration()
        session.startRunning()

        DispatchQueue.main.async {
            self.isConfigured = true
            self.cameraPosition = position
            self.captureSummary = activeCaptureSummary
            self.errorMessage = nil
        }
    }

    private func configureAudioSession() throws {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .videoRecording,
                options: []
            )
            if let builtInMicrophone = audioSession.availableInputs?.first(where: { $0.portType == .builtInMic }) {
                try? audioSession.setPreferredInput(builtInMicrophone)
                debugLog("audio session preferred input: \(builtInMicrophone.portName)")
            }
            try audioSession.setActive(true)
            let inputRoute = audioSession.currentRoute.inputs.map(\.portName).joined(separator: ", ")
            debugLog("audio session category / mode / route: \(audioSession.category.rawValue) / \(audioSession.mode.rawValue) / \(inputRoute)")
        } catch {
            throw CameraError.audioSessionConfigurationFailed(error)
        }
    }

    private func preferredAudioDevice() -> AVCaptureDevice? {
        if let builtInMicrophone = AVCaptureDevice.default(.builtInMicrophone, for: .audio, position: .unspecified) {
            debugLog("selected audio device: \(builtInMicrophone.localizedName) / \(builtInMicrophone.deviceType.rawValue)")
            return builtInMicrophone
        }

        let fallbackDevice = AVCaptureDevice.default(for: .audio)
        if let fallbackDevice {
            debugLog("selected fallback audio device: \(fallbackDevice.localizedName) / \(fallbackDevice.deviceType.rawValue)")
        }
        return fallbackDevice
    }

    private func selectBestVideoDevice(position: AVCaptureDevice.Position) throws -> AVCaptureDevice {
        let preferredTypes: [AVCaptureDevice.DeviceType]
        if position == .front {
            preferredTypes = [
                .builtInTrueDepthCamera,
                .builtInWideAngleCamera
            ]
        } else {
            preferredTypes = [
                .builtInWideAngleCamera,
                .builtInTripleCamera,
                .builtInDualWideCamera,
                .builtInDualCamera
            ]
        }

        var candidates: [AVCaptureDevice] = []
        var seenIDs = Set<String>()

        for type in preferredTypes {
            let discovery = AVCaptureDevice.DiscoverySession(
                deviceTypes: [type],
                mediaType: .video,
                position: position
            )

            for device in discovery.devices where !seenIDs.contains(device.uniqueID) {
                candidates.append(device)
                seenIDs.insert(device.uniqueID)
            }
        }

        guard !candidates.isEmpty else {
            throw CameraError.videoDeviceUnavailable
        }

        let scoredDevices = candidates.compactMap { device -> (device: AVCaptureDevice, score: Int)? in
            guard findClearestCaptureProfile(for: device, environment: .normal) != nil else {
                logClosestFormats(for: device)
                return nil
            }
            return (device, deviceScore(device))
        }

        guard let selected = scoredDevices.max(by: { $0.score < $1.score })?.device else {
            throw CameraError.unsupportedRequiredFormat
        }

        return selected
    }

    private func deviceScore(_ device: AVCaptureDevice) -> Int {
        if device.position == .front {
            switch device.deviceType {
            case .builtInTrueDepthCamera:
                return 300
            case .builtInWideAngleCamera:
                return 200
            default:
                return 0
            }
        }

        switch device.deviceType {
        case .builtInWideAngleCamera:
            return 500
        case .builtInTripleCamera:
            return 400
        case .builtInDualWideCamera:
            return 300
        case .builtInDualCamera:
            return 200
        default:
            return 0
        }
    }

    private func prepareAndStartRecording(videoOrientation: AVCaptureVideoOrientation) {
        guard isPreparingToRecord, isConfigured, !movieOutput.isRecording else { return }

        do {
            if let device = activeVideoDevice {
                _ = try applyBestCaptureProfile(for: device, environment: .normal)
                beginFileRecordingIfStillPreparing(videoOrientation: videoOrientation)
            } else {
                beginFileRecordingIfStillPreparing(videoOrientation: videoOrientation)
            }
        } catch let cameraError as CameraError {
            isPreparingToRecord = false
            publishError(cameraError)
        } catch {
            isPreparingToRecord = false
            publishError(.configurationFailed(error))
        }
    }

    private func beginFileRecordingIfStillPreparing(videoOrientation: AVCaptureVideoOrientation) {
        guard isPreparingToRecord, isConfigured, !movieOutput.isRecording else { return }

        recordingVideoOrientation = videoOrientation
        let url = TempFileStore.makeMovieURL()
        currentRecordingURL = url
        beginRecordingBackgroundTask()

        if let connection = movieOutput.connection(with: .video) {
            configureConnectionForRecording(connection, position: selectedCameraPosition)
        }

        movieOutput.startRecording(to: url, recordingDelegate: self)
    }

    private func applyBestCaptureProfile(for device: AVCaptureDevice, environment: CaptureEnvironment) throws -> Bool {
        guard let selectedProfile = findClearestCaptureProfile(for: device, environment: environment) else {
            throw selectedCameraPosition == .front ? CameraError.unsupportedFrontRequiredFormat : CameraError.unsupportedRequiredFormat
        }

        if let activeCaptureProfile,
           activeCaptureProfile.format === selectedProfile.format,
           activeCaptureProfile.frameRate == selectedProfile.frameRate,
           activeCaptureEnvironment == environment {
            return false
        }

        try configureVideoDevice(device, selectedProfile: selectedProfile, environment: environment)
        if let connection = movieOutput.connection(with: .video) {
            try configureMovieCodec(for: connection, position: selectedCameraPosition, profile: selectedProfile, environment: environment)
        }
        activeCaptureProfile = selectedProfile
        activeCaptureEnvironment = environment
        let updatedCaptureSummary = captureSummary(position: selectedCameraPosition, profile: selectedProfile)
        DispatchQueue.main.async {
            self.captureSummary = updatedCaptureSummary
        }
        logSelectedConfiguration(device: device, profile: selectedProfile)
        return true
    }

    private func currentCaptureEnvironment(for device: AVCaptureDevice) -> CaptureEnvironment {
        let exposureSeconds = CMTimeGetSeconds(device.exposureDuration)
        let finiteExposureSeconds = exposureSeconds.isFinite ? exposureSeconds : 0
        let minISO = max(device.activeFormat.minISO, 1)
        let maxISO = max(device.activeFormat.maxISO, minISO)
        let isoRatio = device.iso / minISO
        let isoPosition = (device.iso - minISO) / max(maxISO - minISO, 1)
        let lowLightBoostActive = device.isLowLightBoostSupported && device.isLowLightBoostEnabled

        if lowLightBoostActive || isoRatio >= 6 || isoPosition >= 0.35 || finiteExposureSeconds >= 1.0 / 45.0 {
            return .lowLight
        }

        if isoRatio <= 2.5 && isoPosition <= 0.12 && finiteExposureSeconds > 0 && finiteExposureSeconds <= 1.0 / 120.0 {
            return .bright
        }

        return .normal
    }

    private func findClearestCaptureProfile(for device: AVCaptureDevice, environment: CaptureEnvironment) -> CaptureProfile? {
        let candidateProfiles = device.formats.flatMap { format -> [CaptureProfile] in
            let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            guard dimensions.width == 3840 && dimensions.height == 2160 else { return [] }

            return preferredClarityFrameRates(for: environment).compactMap { frameRate in
                guard format.videoSupportedFrameRateRanges.contains(where: {
                    $0.minFrameRate <= Double(frameRate) && $0.maxFrameRate >= Double(frameRate)
                }) else {
                    return nil
                }
                return CaptureProfile(format: format, frameRate: frameRate)
            }
        }

        return candidateProfiles.max { lhs, rhs in
            clarityScore(lhs, environment: environment) < clarityScore(rhs, environment: environment)
        }
    }

    private func preferredClarityFrameRates(for environment: CaptureEnvironment) -> [Int32] {
        switch environment {
        case .bright:
            return [60, 30, 50, 24, 25]
        case .normal:
            return [60, 30, 50, 24, 25]
        case .lowLight:
            return [60, 30, 24, 25, 50]
        }
    }

    private func clarityScore(_ profile: CaptureProfile, environment: CaptureEnvironment) -> Int {
        let format = profile.format
        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        var score = Int(dimensions.width) * Int(dimensions.height)

        if dimensions.width == 3840 && dimensions.height == 2160 {
            score += 2_000_000
        }

        switch profile.frameRate {
        case 30:
            switch environment {
            case .bright:
                score += 750_000
            case .normal:
                score += 900_000
            case .lowLight:
                score += 950_000
            }
        case 24, 25:
            score += environment == .lowLight ? 800_000 : 450_000
        case 50, 60:
            switch environment {
            case .bright:
                score += 1_200_000
            case .normal:
                score += 1_000_000
            case .lowLight:
                score += 150_000
            }
        default:
            break
        }

        let mediaSubType = CMFormatDescriptionGetMediaSubType(format.formatDescription)
        if isInternalStorageSafe10BitHLGMovieSubtype(mediaSubType) {
            score += 550_000
        } else if mediaSubType == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ||
            mediaSubType == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange {
            score += 350_000
        }
        if format.supportedColorSpaces.contains(.HLG_BT2020) {
            score += 300_000
        } else if format.supportedColorSpaces.contains(.P3_D65) {
            score += 180_000
        } else if format.supportedColorSpaces.contains(.sRGB) {
            score += 100_000
        }
        score += 200_000
        score += adaptiveFrameRateCoverageScore(for: format)
        return score
    }

    private func configureVideoDevice(_ device: AVCaptureDevice, selectedProfile: CaptureProfile, environment: CaptureEnvironment) throws {
        try device.lockForConfiguration()
        defer {
            device.unlockForConfiguration()
        }

        device.activeFormat = selectedProfile.format
        applyFixedFrameDuration(to: device, profile: selectedProfile)
        device.automaticallyAdjustsVideoHDREnabled = true
        if selectedProfile.format.supportedColorSpaces.contains(.HLG_BT2020) {
            device.activeColorSpace = .HLG_BT2020
        } else if selectedProfile.format.supportedColorSpaces.contains(.P3_D65) {
            device.activeColorSpace = .P3_D65
        } else if selectedProfile.format.supportedColorSpaces.contains(.sRGB) {
            device.activeColorSpace = .sRGB
        }

        if device.isLowLightBoostSupported {
            device.automaticallyEnablesLowLightBoostWhenAvailable = true
        }

        if device.isRampingVideoZoom {
            device.cancelVideoZoomRamp()
        }
        device.videoZoomFactor = min(max(1.0, device.minAvailableVideoZoomFactor), device.maxAvailableVideoZoomFactor)

        configureDailyFocusAndExposure(device, reason: "session configuration")
    }

    private func applyFixedFrameDuration(to device: AVCaptureDevice, profile: CaptureProfile) {
        device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: profile.frameRate)
        device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: profile.frameRate)
        activeCaptureProfile = profile
    }

    private func maximumFrameDuration(for profile: CaptureProfile, environment: CaptureEnvironment) -> CMTime {
        let fallback = CMTime(value: 1, timescale: profile.frameRate)
        let preferredFloorFrameRates: [Int32]

        switch environment {
        case .bright:
            preferredFloorFrameRates = [30, 24, 25]
        case .normal, .lowLight:
            preferredFloorFrameRates = [24, 25, 30]
        }

        guard let floorFrameRate = preferredFloorFrameRates.first(where: { frameRate in
            frameRate <= profile.frameRate &&
                profile.format.videoSupportedFrameRateRanges.contains(where: {
                    $0.minFrameRate <= Double(frameRate) && $0.maxFrameRate >= Double(frameRate)
                })
        }) else {
            return fallback
        }

        return CMTime(value: 1, timescale: floorFrameRate)
    }

    private func runtimeFrameRate(for format: AVCaptureDevice.Format, environment: CaptureEnvironment) -> Int32? {
        preferredClarityFrameRates(for: environment).first { frameRate in
            formatSupportsFrameRate(format, frameRate)
        }
    }

    private func adaptiveFrameRateCoverageScore(for format: AVCaptureDevice.Format) -> Int {
        var score = 0
        if formatSupportsFrameRate(format, 24) || formatSupportsFrameRate(format, 25) {
            score += 90_000
        }
        if formatSupportsFrameRate(format, 30) {
            score += 120_000
        }
        if formatSupportsFrameRate(format, 50) || formatSupportsFrameRate(format, 60) {
            score += 120_000
        }
        return score
    }

    private func formatSupportsFrameRate(_ format: AVCaptureDevice.Format, _ frameRate: Int32) -> Bool {
        format.videoSupportedFrameRateRanges.contains {
            $0.minFrameRate <= Double(frameRate) && $0.maxFrameRate >= Double(frameRate)
        }
    }

    private func startRealtimeCaptureMonitoring() {
        stopRealtimeCaptureMonitoring()

        let timer = DispatchSource.makeTimerSource(queue: sessionQueue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(750), leeway: .milliseconds(150))
        timer.setEventHandler { [weak self] in
            self?.adaptRecordingToCurrentEnvironment()
        }
        recordingAdaptationTimer = timer
        timer.resume()
    }

    private func stopRealtimeCaptureMonitoring() {
        recordingAdaptationTimer?.cancel()
        recordingAdaptationTimer = nil
    }

    private func adaptRecordingToCurrentEnvironment() {
        guard movieOutput.isRecording, let device = activeVideoDevice else { return }

        let environment = currentCaptureEnvironment(for: device)
        if environment != activeCaptureEnvironment {
            debugLog("realtime environment changed: \(activeCaptureEnvironment) -> \(environment)")
            activeCaptureEnvironment = environment
        }
    }

    private func refocusAndExposeAtCenter(reason: String) {
        guard let device = activeVideoDevice else { return }

        do {
            try device.lockForConfiguration()
            configureDailyFocusAndExposure(device, reason: reason)
            device.unlockForConfiguration()
        } catch {
            debugLog("center refocus failed: \(error.localizedDescription)")
        }
    }

    private func configureDailyFocusAndExposure(_ device: AVCaptureDevice, reason: String) {
        var aeStatus = "unsupported"
        var afStatus = "unsupported"

        if device.isExposureModeSupported(.continuousAutoExposure) {
            device.exposureMode = .continuousAutoExposure
            aeStatus = "continuousAutoExposure"
        }

        if device.isExposurePointOfInterestSupported {
            device.exposurePointOfInterest = CGPoint(x: 0.5, y: 0.5)
        }

        if device.isFocusModeSupported(.continuousAutoFocus) {
            device.focusMode = .continuousAutoFocus
            afStatus = "continuousAutoFocus"
        }

        if device.isFocusPointOfInterestSupported {
            device.focusPointOfInterest = CGPoint(x: 0.5, y: 0.5)
        }

        if device.isSmoothAutoFocusSupported {
            device.isSmoothAutoFocusEnabled = true
        }

        device.isSubjectAreaChangeMonitoringEnabled = true
        configureFaceDrivenFocusAndExposure(device)

        debugLog("daily AE / AF status (\(reason)): AE=\(aeStatus), AF=\(afStatus), smoothAF=\(device.isSmoothAutoFocusEnabled)")
    }

    private func configureFaceDrivenFocusAndExposure(_ device: AVCaptureDevice) {
        guard #available(iOS 15.4, *) else {
            debugLog("face-driven AE / AF status: unavailable before iOS 15.4")
            return
        }

        var aeStatus = "not enabled"
        var afStatus = "not enabled"

        if device.isExposureModeSupported(.continuousAutoExposure) {
            device.automaticallyAdjustsFaceDrivenAutoExposureEnabled = false
            device.isFaceDrivenAutoExposureEnabled = true
            aeStatus = "\(device.isFaceDrivenAutoExposureEnabled)"
            device.exposureMode = .continuousAutoExposure
        }

        if device.isFocusModeSupported(.continuousAutoFocus) {
            device.automaticallyAdjustsFaceDrivenAutoFocusEnabled = false
            device.isFaceDrivenAutoFocusEnabled = true
            afStatus = "\(device.isFaceDrivenAutoFocusEnabled)"
            device.focusMode = .continuousAutoFocus
        }

        debugLog("face-driven AE / AF status: AE=\(aeStatus), AF=\(afStatus)")
    }

    private func configureConnectionForRecording(_ connection: AVCaptureConnection, position: AVCaptureDevice.Position) {
        if connection.isVideoOrientationSupported {
            connection.videoOrientation = recordingVideoOrientation
        }

        configureRecordingMirroring(connection, position: position)

        let requestedMode: AVCaptureVideoStabilizationMode
        if connection.isVideoStabilizationSupported {
            connection.preferredVideoStabilizationMode = .auto
            requestedMode = .auto
        } else {
            connection.preferredVideoStabilizationMode = .auto
            requestedMode = .auto
        }

        debugLog("video stabilization requested / active: \(stabilizationName(requestedMode)) / \(stabilizationName(connection.activeVideoStabilizationMode))")
    }

    private func configureRecordingMirroring(_ connection: AVCaptureConnection, position: AVCaptureDevice.Position) {
        guard connection.isVideoMirroringSupported else {
            debugLog("video mirroring unsupported for recording connection")
            return
        }

        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = false
        debugLog(position == .front ? "front recording mirroring: off" : "back recording mirroring: off")
    }

    private func configureMovieCodec(
        for connection: AVCaptureConnection,
        position: AVCaptureDevice.Position,
        profile: CaptureProfile,
        environment: CaptureEnvironment
    ) throws {
        let availableCodecs = movieOutput.availableVideoCodecTypes.map(\.rawValue).joined(separator: ", ")
        debugLog("available movie codecs: \(availableCodecs)")

        let codec: AVVideoCodecType = movieOutput.availableVideoCodecTypes.contains(.hevc) ? .hevc : .h264
        movieOutput.setOutputSettings([AVVideoCodecKey: codec], for: connection)
        debugLog(position == .front ? "movie output codec: \(codec.rawValue) front" : "movie output codec: \(codec.rawValue) main camera")
    }

    private func publishError(_ error: CameraError) {
        DispatchQueue.main.async {
            self.errorMessage = error.localizedDescription
            self.isConfigured = false
            self.captureSummary = ""
        }
    }

    func fileOutput(
        _ output: AVCaptureFileOutput,
        didStartRecordingTo fileURL: URL,
        from connections: [AVCaptureConnection]
    ) {
        sessionQueue.async {
            self.isPreparingToRecord = false
            self.startRealtimeCaptureMonitoring()
        }
        DispatchQueue.main.async {
            self.isRecording = true
            self.onRecordingStarted?()
        }
    }

    func fileOutput(
        _ output: AVCaptureFileOutput,
        didFinishRecordingTo outputFileURL: URL,
        from connections: [AVCaptureConnection],
        error: Error?
    ) {
        sessionQueue.async {
            self.isPreparingToRecord = false
            self.stopRealtimeCaptureMonitoring()
        }
        DispatchQueue.main.async {
            self.isRecording = false
        }

        if let error, !recordingSuccessfullyFinished(error) {
            publishError(.recordingFailed(error))
            endRecordingBackgroundTask()
            return
        }

        PhotoLibrarySaver.saveVideoToLibrary(outputFileURL) { result in
            switch result {
            case .success:
                TempFileStore.removeFile(at: outputFileURL)
                self.currentRecordingURL = nil
                self.onRecordingFinished?(outputFileURL)
            case let .failure(error):
                self.publishError(.savingFailed(error))
            }
            self.endRecordingBackgroundTask()
        }
    }

    private func beginRecordingBackgroundTask() {
        DispatchQueue.main.async {
            guard self.backgroundTaskID == .invalid else { return }
            self.backgroundTaskID = UIApplication.shared.beginBackgroundTask(withName: "Finish recording") {
                self.stopRecording()
                self.endRecordingBackgroundTask()
            }
            self.debugLog("background recording task started: \(self.backgroundTaskID.rawValue)")
        }
    }

    private func endRecordingBackgroundTask() {
        DispatchQueue.main.async {
            guard self.backgroundTaskID != .invalid else { return }
            UIApplication.shared.endBackgroundTask(self.backgroundTaskID)
            self.debugLog("background recording task ended: \(self.backgroundTaskID.rawValue)")
            self.backgroundTaskID = .invalid
        }
    }

    private func recordingSuccessfullyFinished(_ error: Error) -> Bool {
        let nsError = error as NSError
        return (nsError.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool) == true
    }

    private func logSelectedConfiguration(device: AVCaptureDevice, profile: CaptureProfile) {
        let format = profile.format
        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        let mediaSubType = CMFormatDescriptionGetMediaSubType(format.formatDescription)
        let fpsRange = format.videoSupportedFrameRateRanges
            .map { "\(Int($0.minFrameRate))-\(Int($0.maxFrameRate))" }
            .joined(separator: ", ")
        let colorSpaces = format.supportedColorSpaces.map(colorSpaceName).joined(separator: ", ")

        debugLog("Selected device localizedName: \(device.localizedName)")
        debugLog("Selected deviceType: \(device.deviceType.rawValue)")
        debugLog("Selected format dimensions: \(dimensions.width)x\(dimensions.height)")
        debugLog("Selected frame rate: \(profile.frameRate)")
        debugLog("Selected format mediaSubType fourCC: \(fourCC(mediaSubType))")
        debugLog("Selected FPS range: \(fpsRange)")
        debugLog("Selected color spaces: \(colorSpaces)")
        debugLog("activeColorSpace: \(colorSpaceName(device.activeColorSpace))")
        debugLog("isVideoHDRSupported: \(format.isVideoHDRSupported)")
        debugLog("isVideoHDREnabled: \(device.isVideoHDREnabled)")
    }

    private func logClosestFormats(for device: AVCaptureDevice) {
        debugLog("No usable high-quality movie format for \(device.localizedName) (\(device.deviceType.rawValue))")
        let closest = device.formats
            .map { format -> (format: AVCaptureDevice.Format, score: Int) in
                let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
                let maxFPS = format.videoSupportedFrameRateRanges.map(\.maxFrameRate).max() ?? 0
                var score = 0
                if dimensions.width == 3840 && dimensions.height == 2160 { score += 10_000 }
                if preferredClarityFrameRates(for: .normal).contains(where: { frameRate in
                    format.videoSupportedFrameRateRanges.contains(where: { $0.minFrameRate <= Double(frameRate) && $0.maxFrameRate >= Double(frameRate) })
                }) {
                    score += 2_000
                }
                score += Int(maxFPS)
                if isDolbyVisionMovieFormat(format) { score += 2_500 }
                if format.isVideoHDRSupported { score += 1_000 }
                if format.supportedColorSpaces.contains(.HLG_BT2020) { score += 1_000 }
                let mediaSubType = CMFormatDescriptionGetMediaSubType(format.formatDescription)
                if isInternalStorageSafe10BitHLGMovieSubtype(mediaSubType) {
                    score += 1_000
                } else if isProResLikely10Bit422Subtype(mediaSubType) {
                    score += 800
                }
                return (format, score)
            }
            .sorted { $0.score > $1.score }
            .prefix(5)

        for entry in closest {
            let format = entry.format
            let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            let mediaSubType = CMFormatDescriptionGetMediaSubType(format.formatDescription)
            let fpsRange = format.videoSupportedFrameRateRanges
                .map { "\(Int($0.minFrameRate))-\(Int($0.maxFrameRate))" }
                .joined(separator: ", ")
            let colorSpaces = format.supportedColorSpaces.map(colorSpaceName).joined(separator: ", ")
            debugLog("Closest format: \(dimensions.width)x\(dimensions.height), fps=\(fpsRange), dolbyVisionCandidate=\(isDolbyVisionMovieFormat(format)), hdr=\(format.isVideoHDRSupported), subtype=\(fourCC(mediaSubType)), colors=[\(colorSpaces)]")
        }
    }

    private func captureSummary(position: AVCaptureDevice.Position, profile: CaptureProfile) -> String {
        let cameraName = position == .front ? "前置" : "后置主摄"
        let format = profile.format
        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        let hdrName = isDolbyVisionMovieFormat(format) ? " HDR" : ""
        return "\(cameraName) \(dimensions.width)x\(dimensions.height) \(profile.frameRate)fps\(hdrName)"
    }

    private func colorSpaceName(_ colorSpace: AVCaptureColorSpace) -> String {
        if colorSpace == .sRGB {
            return "sRGB"
        }
        if colorSpace == .P3_D65 {
            return "P3_D65"
        }
        if colorSpace == .HLG_BT2020 {
            return "HLG_BT2020"
        }
        if #available(iOS 17.0, *), colorSpace == .appleLog {
            return "appleLog"
        }
        if #available(iOS 26.0, *), colorSpace == .appleLog2 {
            return "appleLog2"
        }
        return "unknown(\(colorSpace.rawValue))"
    }

    private func is10BitYpCbCrBiPlanar(_ mediaSubType: FourCharCode) -> Bool {
        mediaSubType == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange ||
            mediaSubType == kCVPixelFormatType_420YpCbCr10BiPlanarFullRange ||
            mediaSubType == kCVPixelFormatType_422YpCbCr10BiPlanarVideoRange ||
            mediaSubType == kCVPixelFormatType_422YpCbCr10BiPlanarFullRange
    }

    private func isInternalStorageSafe10BitHLGMovieSubtype(_ mediaSubType: FourCharCode) -> Bool {
        mediaSubType == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange ||
            mediaSubType == kCVPixelFormatType_420YpCbCr10BiPlanarFullRange
    }

    private func isDolbyVisionMovieFormat(_ format: AVCaptureDevice.Format) -> Bool {
        let mediaSubType = CMFormatDescriptionGetMediaSubType(format.formatDescription)
        return format.supportedColorSpaces.contains(.HLG_BT2020) &&
            isInternalStorageSafe10BitHLGMovieSubtype(mediaSubType)
    }

    private func targetAverageBitRate(for profile: CaptureProfile, environment: CaptureEnvironment) -> Int {
        switch environment {
        case .bright:
            switch profile.frameRate {
            case 50, 60:
                return 180_000_000
            case 30:
                return 145_000_000
            default:
                return 120_000_000
            }
        case .normal:
            switch profile.frameRate {
            case 50, 60:
                return 165_000_000
            case 30:
                return 135_000_000
            default:
                return 110_000_000
            }
        case .lowLight:
            switch profile.frameRate {
            case 50, 60:
                return 125_000_000
            case 30:
                return 110_000_000
            default:
                return 95_000_000
            }
        }
    }

    private func isProResLikely10Bit422Subtype(_ mediaSubType: FourCharCode) -> Bool {
        mediaSubType == kCVPixelFormatType_422YpCbCr10BiPlanarVideoRange ||
            mediaSubType == kCVPixelFormatType_422YpCbCr10BiPlanarFullRange
    }

    private func stabilizationName(_ mode: AVCaptureVideoStabilizationMode) -> String {
        if mode == .off {
            return "off"
        }
        if mode == .standard {
            return "standard"
        }
        if mode == .cinematic {
            return "cinematic"
        }
        if mode == .cinematicExtended {
            return "cinematicExtended"
        }
        if #available(iOS 17.0, *), mode == .previewOptimized {
            return "previewOptimized"
        }
        if #available(iOS 18.0, *), mode == .cinematicExtendedEnhanced {
            return "cinematicExtendedEnhanced"
        }
        if #available(iOS 26.0, *), mode == .lowLatency {
            return "lowLatency"
        }
        if mode == .auto {
            return "auto"
        }
        return "unknown(\(mode.rawValue))"
    }

    private func fourCC(_ value: FourCharCode) -> String {
        let bytes: [UInt8] = [
            UInt8((value >> 24) & 0xff),
            UInt8((value >> 16) & 0xff),
            UInt8((value >> 8) & 0xff),
            UInt8(value & 0xff)
        ]
        return String(bytes: bytes, encoding: .macOSRoman) ?? "\(value)"
    }

    private func debugLog(_ message: String) {
        #if DEBUG
        print("[UltimateCamera] \(message)")
        #endif
    }
}

private enum CameraSetupError: LocalizedError {
    case cannotAddMovieOutput

    var errorDescription: String? {
        switch self {
        case .cannotAddMovieOutput:
            return "无法添加录像输出"
        }
    }
}

import AVFoundation
import Foundation
import SwiftUI

private enum VoiceStatus: String, CaseIterable, Codable {
    case normal = "正常"
    case tired = "嗓子累"
    case meeting = "会议前"
}

private struct TrainingPlan: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let minutes: Int
    let goal: String
    let reason: String
    let steps: [TrainingStep]
    var focus: String? = nil
    var source: String? = nil
}

private struct TrainingStep: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let seconds: Int
    let cue: String
    let instruction: String
}

private struct TrainingRecord: Identifiable, Codable {
    let id: String
    let date: Date
    let title: String
    let minutes: Int
    let score: Int
    let note: String
    var planId: String? = nil
    var goal: String? = nil
    var focus: String? = nil
    var stepTitles: [String]? = nil
}

private struct VoiceRecording: Identifiable, Codable {
    let id: String
    let date: Date
    let fileName: String
    let seconds: Int
}

private final class VoiceCoachStore: ObservableObject {
    @Published var records: [TrainingRecord] = [] { didSet { saveRecords() } }
    @Published var recordings: [VoiceRecording] = [] { didSet { saveRecordings() } }
    @AppStorage("voiceCoach.aiBaseURL") var aiBaseURL = ""

    private let recordsKey = "voiceCoach.records.v1"
    private let recordingsKey = "voiceCoach.recordings.v1"

    init() {
        records = Self.load([TrainingRecord].self, key: recordsKey) ?? []
        recordings = Self.load([VoiceRecording].self, key: recordingsKey) ?? []
    }

    var recentRecords: [TrainingRecord] {
        records.sorted { $0.date > $1.date }
    }

    var weeklyCount: Int {
        records.filter { Calendar.current.dateComponents([.day], from: $0.date, to: Date()).day ?? 99 < 7 }.count
    }

    var monthlyCount: Int {
        records.filter { Calendar.current.dateComponents([.day], from: $0.date, to: Date()).day ?? 99 < 30 }.count
    }

    var averageMinutes: Int {
        guard !records.isEmpty else { return 0 }
        return records.map(\.minutes).reduce(0, +) / records.count
    }

    var lastTrainingText: String {
        guard let last = recentRecords.first else { return "还没有训练记录" }
        return "\(last.title) · \(Self.shortDate(last.date))"
    }

    func addRecord(plan: TrainingPlan, score: Int, note: String) {
        records.insert(
            TrainingRecord(
                id: UUID().uuidString,
                date: Date(),
                title: plan.title,
                minutes: plan.minutes,
                score: score,
                note: note,
                planId: plan.id,
                goal: plan.goal,
                focus: plan.focus,
                stepTitles: plan.steps.map(\.title)
            ),
            at: 0
        )
    }

    func deleteRecordings(at offsets: IndexSet) {
        for index in offsets {
            let item = recordings.sorted { $0.date > $1.date }[index]
            try? FileManager.default.removeItem(at: recordingURL(fileName: item.fileName))
            recordings.removeAll { $0.id == item.id }
        }
    }

    func deleteAllData() {
        records = []
        for recording in recordings {
            try? FileManager.default.removeItem(at: recordingURL(fileName: recording.fileName))
        }
        recordings = []
    }

    func recordingURL(fileName: String) -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(fileName)
    }

    private func saveRecords() {
        Self.save(records, key: recordsKey)
    }

    private func saveRecordings() {
        Self.save(recordings, key: recordingsKey)
    }

    private static func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func save<T: Encodable>(_ value: T, key: String) {
        if let data = try? JSONEncoder().encode(value) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func shortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日 HH:mm"
        return formatter.string(from: date)
    }

    static func isoDate(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }
}

private struct PracticeHistoryItem: Encodable {
    let practicedAt: String
    let title: String
    let minutes: Int
    let score: Int
    let note: String
    let goal: String?
    let focus: String?
    let steps: [String]
}

private struct PracticeTotals: Encodable {
    let totalSessions: Int
    let minutesToday: Int
    let minutesLast7Days: Int
    let lastPracticeAt: String?
}

private struct NextPracticeRequest: Encodable {
    let requestedAt: String
    let userIntent: String
    let recentSessions: [PracticeHistoryItem]
    let totals: PracticeTotals
    let guardrails: [String]
    let localFallbackPlan: TrainingPlan
}

private enum CoachPlanner {
    static func nextPractice(store: VoiceCoachStore) async -> TrainingPlan {
        let fallback = makeAdaptivePlan(records: store.records)
        guard let endpoint = nextPracticeEndpoint(from: store.aiBaseURL) else {
            return fallback
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 20

        do {
            request.httpBody = try JSONEncoder().encode(requestBody(store: store, fallback: fallback))
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return fallback }
            let plan = try JSONDecoder().decode(TrainingPlan.self, from: data)
            return validate(plan: plan) ?? fallback
        } catch {
            return fallback
        }
    }

    private static func nextPracticeEndpoint(from baseURL: String) -> URL? {
        let trimmed = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let normalized = trimmed.hasSuffix("/") ? String(trimmed.dropLast()) : trimmed
        return URL(string: "\(normalized)/ai/next-practice")
    }

    private static func requestBody(store: VoiceCoachStore, fallback: TrainingPlan) -> NextPracticeRequest {
        let recent = store.recentRecords.prefix(30).map { record in
            PracticeHistoryItem(
                practicedAt: VoiceCoachStore.isoDate(record.date),
                title: record.title,
                minutes: record.minutes,
                score: record.score,
                note: record.note,
                goal: record.goal,
                focus: record.focus,
                steps: record.stepTitles ?? []
            )
        }
        let todayStart = Calendar.current.startOfDay(for: Date())
        let last7Start = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        let totals = PracticeTotals(
            totalSessions: store.records.count,
            minutesToday: store.records.filter { $0.date >= todayStart }.map(\.minutes).reduce(0, +),
            minutesLast7Days: store.records.filter { $0.date >= last7Start }.map(\.minutes).reduce(0, +),
            lastPracticeAt: store.recentRecords.first.map { VoiceCoachStore.isoDate($0.date) }
        )

        return NextPracticeRequest(
            requestedAt: VoiceCoachStore.isoDate(Date()),
            userIntent: "我现在有时间，请根据历史记录安排下一次练什么和练多长时间。",
            recentSessions: Array(recent),
            totals: totals,
            guardrails: [
                "用户只决定什么时候练，不手动选择训练内容或分钟数。",
                "不要设置每天必须练、每天只能练一次或补打卡规则。",
                "练习方法必须温和、低风险、可执行；不鼓励播音腔或刻意压低声音。",
                "如有嗓子疼、明显嘶哑、说话费力，应降低强度或停止发声训练。"
            ],
            localFallbackPlan: fallback
        )
    }

    private static func validate(plan: TrainingPlan) -> TrainingPlan? {
        guard (3...20).contains(plan.minutes), (2...5).contains(plan.steps.count) else { return nil }
        guard !plan.title.isEmpty, !plan.goal.isEmpty, !plan.reason.isEmpty else { return nil }
        let allText = ([plan.title, plan.goal, plan.reason] + plan.steps.flatMap { [$0.title, $0.cue, $0.instruction] }).joined(separator: "\n")
        let unsafe = ["疼痛时坚持", "嘶哑时继续", "大声喊", "用力吼", "憋到极限", "强行压低"]
        guard !unsafe.contains(where: { allText.contains($0) }) else { return nil }
        guard plan.steps.allSatisfy({ $0.seconds >= 30 && !$0.instruction.isEmpty }) else { return nil }
        return plan
    }
}

private final class TrainingSessionModel: ObservableObject {
    @Published var plan: TrainingPlan
    @Published var stepIndex = 0
    @Published var remaining = 0
    @Published var running = false
    private var timer: Timer?

    init(plan: TrainingPlan) {
        self.plan = plan
        self.remaining = plan.steps.first?.seconds ?? 60
    }

    var currentStep: TrainingStep {
        plan.steps[min(stepIndex, plan.steps.count - 1)]
    }

    var finished: Bool {
        stepIndex >= plan.steps.count
    }

    func toggle() {
        running ? pause() : start()
    }

    func start() {
        guard !finished else { return }
        running = true
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    func pause() {
        running = false
        timer?.invalidate()
        timer = nil
    }

    func next() {
        pause()
        stepIndex += 1
        remaining = stepIndex < plan.steps.count ? plan.steps[stepIndex].seconds : 0
    }

    func reset() {
        pause()
        stepIndex = 0
        remaining = plan.steps.first?.seconds ?? 60
    }

    func replace(with newPlan: TrainingPlan) {
        pause()
        plan = newPlan
        stepIndex = 0
        remaining = newPlan.steps.first?.seconds ?? 60
    }

    private func tick() {
        if remaining > 1 {
            remaining -= 1
        } else {
            next()
        }
    }
}

private final class RecordingModel: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var isRecording = false
    @Published var seconds = 0
    @Published var permissionDenied = false
    private var recorder: AVAudioRecorder?
    private var player: AVAudioPlayer?
    private var timer: Timer?
    private weak var store: VoiceCoachStore?

    func start(store: VoiceCoachStore) {
        self.store = store
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                guard granted else {
                    self?.permissionDenied = true
                    return
                }
                self?.beginRecording(store: store)
            }
        }
    }

    func stop() {
        recorder?.stop()
        finishRecording()
    }

    func play(recording: VoiceRecording, store: VoiceCoachStore) {
        let url = store.recordingURL(fileName: recording.fileName)
        player = try? AVAudioPlayer(contentsOf: url)
        player?.prepareToPlay()
        player?.play()
    }

    private func beginRecording(store: VoiceCoachStore) {
        let fileName = "voice-\(UUID().uuidString).m4a"
        let url = store.recordingURL(fileName: fileName)
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        do {
            try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try AVAudioSession.sharedInstance().setActive(true)
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.delegate = self
            recorder?.record()
            seconds = 0
            isRecording = true
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                self?.seconds += 1
            }
        } catch {
            permissionDenied = true
        }
    }

    private func finishRecording() {
        timer?.invalidate()
        timer = nil
        guard isRecording, let recorder, let store else { return }
        isRecording = false
        store.recordings.insert(
            VoiceRecording(id: UUID().uuidString, date: Date(), fileName: recorder.url.lastPathComponent, seconds: max(seconds, 1)),
            at: 0
        )
        self.recorder = nil
    }
}

struct ContentView: View {
    @StateObject private var store = VoiceCoachStore()

    var body: some View {
        TabView {
            HomeView()
                .environmentObject(store)
                .tabItem { Label("训练", systemImage: "house.fill") }

            RecordingView()
                .environmentObject(store)
                .tabItem { Label("录音", systemImage: "mic.fill") }

            ProgressView()
                .environmentObject(store)
                .tabItem { Label("进展", systemImage: "chart.bar.fill") }

            SettingsView()
                .environmentObject(store)
                .tabItem { Label("设置", systemImage: "gearshape.fill") }
        }
        .tint(.blue)
    }
}

private struct HomeView: View {
    @EnvironmentObject private var store: VoiceCoachStore
    @State private var currentPlan: TrainingPlan?
    @State private var activePlan: TrainingPlan?
    @State private var isLoadingPlan = false

    private var plan: TrainingPlan {
        currentPlan ?? makeAdaptivePlan(records: store.records)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    planCard
                    toolsCard
                    progressCard
                    recentCard
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarHidden(true)
            .onAppear {
                if currentPlan == nil {
                    currentPlan = makeAdaptivePlan(records: store.records)
                }
            }
            .sheet(item: $activePlan) { plan in
                TrainingRunView(plan: plan)
                    .environmentObject(store)
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("稳声 Coach")
                    .font(.system(size: 33, weight: .black))
                    .foregroundStyle(.primary)
                Text("清、稳、准、暖、留")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "slider.horizontal.3")
                .font(.title3.weight(.bold))
                .frame(width: 44, height: 44)
                .background(.white, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separator).opacity(0.35)))
        }
        .padding(.top, 16)
    }

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.blue.opacity(0.12))
                    Image(systemName: "waveform")
                        .font(.system(size: 42, weight: .semibold))
                        .foregroundStyle(.blue)
                }
                .frame(width: 86, height: 86)

                VStack(alignment: .leading, spacing: 6) {
                    Text("下一练")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(plan.title)
                        .font(.system(size: 28, weight: .black))
                        .foregroundStyle(Color(red: 0.03, green: 0.09, blue: 0.20))
                    HStack(spacing: 8) {
                        Label("\(plan.minutes) 分钟", systemImage: "clock")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(plan.source == "ai" ? "AI 安排" : "本机兜底")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(plan.source == "ai" ? .blue : .green)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background((plan.source == "ai" ? Color.blue : Color.green).opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                    }
                }
            }

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Label("本次唯一目标", systemImage: "target")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(plan.goal)
                    .font(.title3.weight(.black))
                    .foregroundStyle(.primary)
            }

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "lightbulb")
                    .foregroundStyle(.secondary)
                Text(plan.reason)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineSpacing(3)
            }

            Button {
                requestNextPractice()
            } label: {
                Label(isLoadingPlan ? "正在安排..." : "我现在有时间", systemImage: isLoadingPlan ? "sparkles" : "play.circle.fill")
                    .font(.headline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.blue, in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(.white)
            }
            .disabled(isLoadingPlan)

            Text("你只决定什么时候练；练什么、练几分钟，由 AI 根据历史记录判断。未配置 AI 服务时，本机会按同样安全边界临时兜底。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .cardStyle()
    }

    private var toolsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("更多工具")
                .font(.title3.weight(.black))
                .padding(.bottom, 8)
            ToolRow(icon: "doc.text.fill", title: "公务训练稿", subtitle: "内置固定短稿，适合通勤前练")
            ToolRow(icon: "list.clipboard.fill", title: "AI 周复盘", subtitle: store.aiBaseURL.isEmpty ? "设置远程 AI 服务后可用" : "已配置 AI 服务地址")
        }
        .cardStyle()
    }

    private var progressCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("本周与本月进展")
                .font(.title3.weight(.black))
            HStack {
                Metric(value: "\(store.weeklyCount) 次", label: "本周")
                Divider()
                Metric(value: "\(store.monthlyCount) 次", label: "近 30 天")
                Divider()
                Metric(value: "\(store.averageMinutes) 分", label: "平均时长")
            }
        }
        .cardStyle()
    }

    private var recentCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("最近训练")
                .font(.title3.weight(.black))
            Text(store.lastTrainingText)
                .font(.body.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .cardStyle()
    }

    private func requestNextPractice() {
        guard !isLoadingPlan else { return }
        isLoadingPlan = true
        Task {
            let next = await CoachPlanner.nextPractice(store: store)
            await MainActor.run {
                currentPlan = next
                activePlan = next
                isLoadingPlan = false
            }
        }
    }
}

private struct TrainingRunView: View {
    @EnvironmentObject private var store: VoiceCoachStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model: TrainingSessionModel
    @State private var score = 4
    @State private var note = ""
    @State private var showingReview = false
    @State private var isLoadingNext = false

    init(plan: TrainingPlan) {
        _model = StateObject(wrappedValue: TrainingSessionModel(plan: plan))
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.finished {
                    review
                        .padding(18)
                } else {
                    VStack(spacing: 0) {
                        ScrollView {
                            stepView
                                .padding(18)
                                .padding(.bottom, 8)
                        }

                        Divider()
                        controls
                            .padding(.horizontal, 18)
                            .padding(.top, 12)
                            .padding(.bottom, 16)
                            .background(.ultraThinMaterial)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemGroupedBackground))
            .navigationTitle(model.finished ? "训练复盘" : "跟练")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("关闭") { dismiss() }
                }
            }
        }
    }

    private var stepView: some View {
        VStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(model.plan.title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Text("第 \(model.stepIndex + 1) 步 / 共 \(model.plan.steps.count) 步")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.secondary)
                        Text(model.currentStep.title)
                            .font(.title3.weight(.black))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Text(timeText(model.remaining))
                        .font(.system(size: 24, weight: .black, design: .rounded))
                        .foregroundStyle(.blue)
                        .monospacedDigit()
                        .frame(width: 96, height: 62)
                        .background(Color.blue.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Label("怎么练", systemImage: "figure.mind.and.body")
                        .font(.title3.weight(.black))
                        .foregroundStyle(.blue)
                    Text(model.currentStep.instruction)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.primary)
                        .lineSpacing(7)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("做到这个感觉")
                            .font(.subheadline.weight(.bold))
                        Text(model.currentStep.cue)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))

                Text(model.plan.reason)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()

            VStack(alignment: .leading, spacing: 12) {
                Text("本次流程")
                    .font(.headline.weight(.black))
                ForEach(Array(model.plan.steps.enumerated()), id: \.element.id) { index, step in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(index + 1)")
                            .font(.caption.weight(.black))
                            .foregroundStyle(index == model.stepIndex ? .white : .blue)
                            .frame(width: 24, height: 24)
                            .background(index == model.stepIndex ? Color.blue : Color.blue.opacity(0.12), in: Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text(step.title)
                                .font(.subheadline.weight(.bold))
                            Text(step.cue)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 4)
                }
            }
            .cardStyle()
        }
    }

    private var controls: some View {
        HStack(spacing: 10) {
            Button {
                model.toggle()
            } label: {
                Label(model.running ? "暂停" : "开始", systemImage: model.running ? "pause.fill" : "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button {
                model.next()
            } label: {
                Text(model.stepIndex == model.plan.steps.count - 1 ? "完成" : "下一步")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
    }

    private var review: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("今天的手感")
                .font(.title2.weight(.black))
            Text("这条复盘会进入历史记录，下一练会根据它重新安排。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Picker("评分", selection: $score) {
                ForEach(1...5, id: \.self) { Text("\($0) 分").tag($0) }
            }
            .pickerStyle(.segmented)

            TextField("一句话记录", text: $note, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...4)

            Button {
                saveAndContinue()
            } label: {
                Text(isLoadingNext ? "正在安排下一练..." : "保存并继续下一练")
                    .font(.headline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.blue, in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(.white)
            }
            .disabled(isLoadingNext)

            Button {
                store.addRecord(plan: model.plan, score: score, note: note)
                dismiss()
            } label: {
                Text("保存，今天先到这里")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(isLoadingNext)
        }
        .cardStyle()
    }

    private func saveAndContinue() {
        guard !isLoadingNext else { return }
        isLoadingNext = true
        store.addRecord(plan: model.plan, score: score, note: note)
        Task {
            let next = await CoachPlanner.nextPractice(store: store)
            await MainActor.run {
                model.replace(with: next)
                score = 4
                note = ""
                isLoadingNext = false
            }
        }
    }
}

private struct RecordingView: View {
    @EnvironmentObject private var store: VoiceCoachStore
    @StateObject private var recorder = RecordingModel()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(recorder.isRecording ? "正在录音" : "准备录音")
                                    .font(.title3.weight(.black))
                                Text(timeText(recorder.seconds))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "mic.fill")
                                .font(.title)
                                .foregroundStyle(recorder.isRecording ? .white : .blue)
                                .frame(width: 62, height: 62)
                                .background(recorder.isRecording ? Color.red : Color.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        }
                        Button {
                            recorder.isRecording ? recorder.stop() : recorder.start(store: store)
                        } label: {
                            Text(recorder.isRecording ? "停止录音" : "开始录音")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                    }
                    .padding(.vertical, 6)
                }

                Section("最近录音") {
                    ForEach(store.recordings.sorted { $0.date > $1.date }) { item in
                        Button {
                            recorder.play(recording: item, store: store)
                        } label: {
                            HStack {
                                Image(systemName: "waveform.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.blue)
                                VStack(alignment: .leading) {
                                    Text(VoiceCoachStore.shortDate(item.date))
                                        .font(.headline)
                                    Text(timeText(item.seconds))
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .onDelete { store.deleteRecordings(at: $0) }
                }
            }
            .navigationTitle("录音复盘")
            .alert("需要麦克风权限", isPresented: $recorder.permissionDenied) {
                Button("好") {}
            } message: {
                Text("请在系统设置里允许稳声 Coach 使用麦克风。")
            }
        }
    }
}

private struct ProgressView: View {
    @EnvironmentObject private var store: VoiceCoachStore

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Metric(value: "\(store.weeklyCount) 次", label: "近 7 天")
                        Divider()
                        Metric(value: "\(store.monthlyCount) 次", label: "近 30 天")
                        Divider()
                        Metric(value: "\(store.averageMinutes) 分", label: "平均时长")
                    }
                    .padding(.vertical, 12)
                }

                Section("训练记录") {
                    if store.recentRecords.isEmpty {
                        Text("还没有训练记录")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.recentRecords) { item in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(item.title)
                                    .font(.headline)
                                Spacer()
                                Text("\(item.score) 分")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(.green)
                            }
                            Text("\(VoiceCoachStore.shortDate(item.date)) · \(item.minutes) 分钟")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if !item.note.isEmpty {
                                Text(item.note)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("进展")
        }
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var store: VoiceCoachStore
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section("AI 服务") {
                    TextField("https://your-ai-service.example.com", text: $store.aiBaseURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    Text("配置后，AI 会收到最近训练的时间、时长、内容、评分和备注，用来安排下一练。录音不会默认上传；API Key 不放在手机里。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("数据") {
                    Button("清空本机训练与录音", role: .destructive) {
                        confirmDelete = true
                    }
                }

                Section("版本") {
                    Text("稳声 Coach 原生预览 0.3")
                }
            }
            .navigationTitle("设置")
            .confirmationDialog("清空本机数据？", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("确认清空", role: .destructive) { store.deleteAllData() }
                Button("取消", role: .cancel) {}
            }
        }
    }
}

private struct ToolRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 44, height: 44)
                .background(Color.blue.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 10)
    }
}

private struct Metric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2.weight(.black))
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private extension View {
    func cardStyle() -> some View {
        self
            .padding(16)
            .background(.white, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separator).opacity(0.25)))
            .shadow(color: Color.black.opacity(0.05), radius: 10, y: 4)
    }
}

private func makeAdaptivePlan(records: [TrainingRecord]) -> TrainingPlan {
    let todayStart = Calendar.current.startOfDay(for: Date())
    let todayMinutes = records.filter { $0.date >= todayStart }.map(\.minutes).reduce(0, +)
    let recentText = records.prefix(3).map { "\($0.title) \($0.goal ?? "") \($0.note)" }.joined(separator: " ")

    if todayMinutes >= 25 || containsVoiceRisk(recentText) {
        var plan = makePlan(minutes: 3, status: .tired, recentCount: records.count)
        plan.source = "local"
        plan.focus = "recovery"
        return plan
    }

    let minutes = recommendedMinutes(records: records, todayMinutes: todayMinutes)
    let focus = nextFocus(records: records)
    let plan: TrainingPlan
    switch focus {
    case "resonance":
        plan = makeResonancePlan(minutes: minutes)
    case "tone":
        plan = makeTonePlan(minutes: minutes)
    case "articulation":
        plan = makeArticulationPlan(minutes: minutes)
    case "scenario":
        plan = makeScenarioPlan(minutes: minutes)
    default:
        plan = makePlan(minutes: minutes, status: .normal, recentCount: records.count)
    }
    var tagged = plan
    tagged.source = "local"
    tagged.focus = focus
    return tagged
}

private func recommendedMinutes(records: [TrainingRecord], todayMinutes: Int) -> Int {
    guard let last = records.sorted(by: { $0.date > $1.date }).first else { return 5 }
    let daysSinceLast = Calendar.current.dateComponents([.day], from: last.date, to: Date()).day ?? 0
    if daysSinceLast >= 7 { return 4 }
    if todayMinutes == 0 { return records.count < 3 ? 5 : 8 }
    if todayMinutes < 12 { return 6 }
    return 4
}

private func nextFocus(records: [TrainingRecord]) -> String {
    let candidates = ["breath", "resonance", "tone", "articulation", "scenario"]
    let recent = records.sorted(by: { $0.date > $1.date }).prefix(12)
    let inferred = recent.map { $0.focus ?? inferFocus(from: "\($0.title) \($0.goal ?? "") \($0.stepTitles?.joined(separator: " ") ?? "")") }
    let last = inferred.first
    return candidates.min { left, right in
        let leftScore = inferred.filter { $0 == left }.count + (left == last ? 2 : 0)
        let rightScore = inferred.filter { $0 == right }.count + (right == last ? 2 : 0)
        return leftScore < rightScore
    } ?? "breath"
}

private func inferFocus(from text: String) -> String {
    if text.contains("共鸣") || text.contains("闭口") || text.contains("轻哼") { return "resonance" }
    if text.contains("句尾") || text.contains("语气") || text.contains("落尾") { return "tone" }
    if text.contains("咬字") || text.contains("清晰") || text.contains("字头") { return "articulation" }
    if text.contains("公务") || text.contains("会议") || text.contains("表达") { return "scenario" }
    return "breath"
}

private func containsVoiceRisk(_ text: String) -> Bool {
    ["嗓子疼", "喉咙疼", "明显嘶哑", "说话费力", "失声"].contains { text.contains($0) }
}

private func makeResonancePlan(minutes: Int) -> TrainingPlan {
    let total = minutes * 60
    let release = max(45, total / 5)
    let hum = max(90, total * 2 / 5)
    let words = total - release - hum
    return TrainingPlan(
        id: "adaptive-resonance-\(minutes)",
        title: "\(minutes) 分钟前置共鸣",
        minutes: minutes,
        goal: "把声音从喉咙里放出来，找到轻松靠前的振动。",
        reason: "下一练安排共鸣，是为了让声音更省力、更清楚，而不是压低或变厚。",
        steps: [
            TrainingStep(
                id: "release",
                title: "口腔放松",
                seconds: release,
                cue: "下颌松，舌根不顶。",
                instruction: """
                1. 嘴唇轻闭，牙齿不要咬紧。
                2. 舌头自然放平，舌尖轻靠下齿背。
                3. 下巴像挂着一样放松，不向前顶。
                4. 做两轮安静呼吸后再发声。
                """
            ),
            TrainingStep(
                id: "hum",
                title: "闭口轻哼",
                seconds: hum,
                cue: "鼻前和唇边有轻微振动。",
                instruction: """
                1. 用很小音量发“嗯——”，不要追求响。
                2. 感觉振动在鼻前、嘴唇附近，不往喉咙里压。
                3. 每次 4 秒出声，2 秒停顿。
                4. 一旦喉咙发紧，立刻减小音量。
                """
            ),
            TrainingStep(
                id: "words",
                title: "嗯到短句",
                seconds: max(60, words),
                cue: "字从前面出来，喉咙只是通过。",
                instruction: """
                1. 先读“嗯-妈-明”，保持唇边振动。
                2. 再读：我们今天先把重点说清楚。
                3. 开头轻一点，不要一上来就冲。
                4. 句尾落住后再停，不急着接下一句。
                """
            ),
        ]
    )
}

private func makeTonePlan(minutes: Int) -> TrainingPlan {
    let total = minutes * 60
    let breath = max(60, total / 4)
    let landing = max(90, total / 3)
    let scenario = total - breath - landing
    return TrainingPlan(
        id: "adaptive-tone-\(minutes)",
        title: "\(minutes) 分钟句尾落点",
        minutes: minutes,
        goal: "让表达有停顿、有落点，不前冲后飘。",
        reason: "下一练安排语气和句尾，是为了让公务表达更稳、更可听。",
        steps: [
            TrainingStep(
                id: "breath",
                title: "开口前一口气",
                seconds: breath,
                cue: "吸气够用即可，不抢。",
                instruction: """
                1. 鼻吸 2 秒，肩膀不抬。
                2. 呼气 4 秒，保持细而不断。
                3. 每轮结束停半拍。
                4. 记住这种不急的节奏。
                """
            ),
            TrainingStep(
                id: "landing",
                title: "句尾慢半拍",
                seconds: landing,
                cue: "最后两个字放慢，落住。",
                instruction: """
                1. 练句：这项工作我们先按既定节奏推进。
                2. 逗号前停半拍，句尾不要上扬。
                3. 第二遍把最后两个字放慢一点。
                4. 不要演讲腔，用真实工作音量。
                """
            ),
            TrainingStep(
                id: "scenario",
                title: "三句话表达",
                seconds: max(60, scenario),
                cue: "每句话说完都留一点空间。",
                instruction: """
                1. 用三句话讲一个真实事项：背景、判断、下一步。
                2. 每句话不超过 15 个字。
                3. 每句后停半拍，让对方接收。
                4. 目标是稳，不是快。
                """
            ),
        ]
    )
}

private func makeArticulationPlan(minutes: Int) -> TrainingPlan {
    let total = minutes * 60
    let relax = max(45, total / 5)
    let syllables = max(90, total * 2 / 5)
    let sentence = total - relax - syllables
    return TrainingPlan(
        id: "adaptive-articulation-\(minutes)",
        title: "\(minutes) 分钟咬字清晰",
        minutes: minutes,
        goal: "让字头清楚，但不把嘴和喉咙练紧。",
        reason: "下一练安排咬字，是为了提升清晰度，同时保持声音松、稳、自然。",
        steps: [
            TrainingStep(
                id: "relax",
                title: "唇舌放松",
                seconds: relax,
                cue: "嘴唇灵活，舌头不僵。",
                instruction: """
                1. 嘴唇轻轻开合 8 次，不用力抿。
                2. 舌尖轻点上齿背，再放回下齿背。
                3. 下颌保持松，不要咬字咬到牙关紧。
                4. 做完再进入发音。
                """
            ),
            TrainingStep(
                id: "syllables",
                title: "轻读字头",
                seconds: syllables,
                cue: "字头清楚，声音不断。",
                instruction: """
                1. 轻读：把、办、比、明、定、听。
                2. 每个字开头清楚，但不要喷气太重。
                3. 连成短组：把重点、办清楚、定下来。
                4. 读慢一点，保证每个字自然出来。
                """
            ),
            TrainingStep(
                id: "sentence",
                title: "短句清晰",
                seconds: max(60, sentence),
                cue: "关键词清楚，句子不断线。",
                instruction: """
                1. 练句：我们把材料再核一遍，今天形成初步意见。
                2. 关键词“材料、核、今天、意见”稍微清楚一点。
                3. 不要每个字都用力，重点字清楚即可。
                4. 最后一遍换成你的真实工作句。
                """
            ),
        ]
    )
}

private func makeScenarioPlan(minutes: Int) -> TrainingPlan {
    let total = minutes * 60
    let prepare = max(60, total / 4)
    let read = max(120, total / 2)
    let own = total - prepare - read
    return TrainingPlan(
        id: "adaptive-scenario-\(minutes)",
        title: "\(minutes) 分钟公务场景",
        minutes: minutes,
        goal: "把训练迁移到真实工作表达里。",
        reason: "下一练安排场景迁移，是为了避免只会练动作、不会用在开会和汇报中。",
        steps: [
            TrainingStep(
                id: "prepare",
                title: "定一个真实场景",
                seconds: prepare,
                cue: "只选一件事，不贪多。",
                instruction: """
                1. 想一个你今天可能要说的工作事项。
                2. 写在心里：背景是什么、判断是什么、下一步是什么。
                3. 每部分只保留一句话。
                4. 开始前先吸一口够用的气。
                """
            ),
            TrainingStep(
                id: "read",
                title: "固定稿跟读",
                seconds: read,
                cue: "语气稳，停顿清楚。",
                instruction: """
                1. 读：我简要说三点。第一，目前进展总体可控。第二，关键是把口径再统一。第三，我建议今天先完成材料核对，明天形成正式意见。
                2. 每个序号后停半拍。
                3. 句尾落住，不急着接下一句。
                4. 用工作音量读，不要表演。
                """
            ),
            TrainingStep(
                id: "own",
                title: "换成自己的话",
                seconds: max(60, own),
                cue: "清楚、稳、留空间。",
                instruction: """
                1. 用你的真实事项替换固定稿。
                2. 仍然按三点说：背景、判断、下一步。
                3. 每句话说完停半拍。
                4. 练完记一句：哪里稳了，哪里还急。
                """
            ),
        ]
    )
}

private func makePlan(minutes: Int, status: VoiceStatus, recentCount: Int) -> TrainingPlan {
    if status == .tired {
        return TrainingPlan(
            id: "tired",
            title: "3 分钟嗓子恢复包",
            minutes: 3,
            goal: "不追求音色，只让喉咙轻松。",
            reason: "今天先降低强度，用肩颈放松和轻哼恢复手感。",
            steps: [
                TrainingStep(
                    id: "neck",
                    title: "肩颈放松",
                    seconds: 60,
                    cue: "肩膀向下放，喉咙没有顶住的感觉。",
                    instruction: """
                    1. 坐直或站稳，脚掌踩实，肩膀自然落下。
                    2. 头轻轻向左、向右各停 2 秒，不要绕大圈。
                    3. 双肩向后慢慢转 6 次，转到后侧时停半拍。
                    4. 嘴唇轻闭，下颌像放在软垫上，不咬牙。
                    """
                ),
                TrainingStep(
                    id: "sigh",
                    title: "哈欠叹气",
                    seconds: 60,
                    cue: "像叹一口舒服的气，声音轻轻滑出来。",
                    instruction: """
                    1. 先做一个很小的哈欠，让软腭打开。
                    2. 呼气时带一点“哈——”，音量只要自己听见。
                    3. 不要压低嗓子，也不要故意做厚重声音。
                    4. 每次叹完停 1 秒，确认喉咙比刚才更松。
                    """
                ),
                TrainingStep(
                    id: "hum",
                    title: "闭口轻哼",
                    seconds: 60,
                    cue: "鼻前和嘴唇周围有轻微振动，喉咙不挤。",
                    instruction: """
                    1. 嘴唇轻轻闭上，牙齿不要咬紧。
                    2. 用很小音量发“嗯——”，像轻轻回应别人。
                    3. 每次 4 秒出声，2 秒停顿，重复到计时结束。
                    4. 如果喉咙发紧，立刻减小音量，只保留气息。
                    """
                )
            ]
        )
    }

    if status == .meeting {
        return TrainingPlan(
            id: "meeting",
            title: "会议前 3 分钟包",
            minutes: 3,
            goal: "开口更稳，句尾更落。",
            reason: "会议前不练新东西，只让气息稳、句尾收住。",
            steps: [
                TrainingStep(
                    id: "breath",
                    title: "低位吸气",
                    seconds: 60,
                    cue: "吸气时肩膀不抬，腰腹有一点撑开。",
                    instruction: """
                    1. 鼻子轻吸 2 秒，感觉气落到腰腹，不吸满。
                    2. 嘴巴慢慢呼 4 秒，气流细一点、不断线。
                    3. 呼气时胸口不往上顶，肩膀保持自然下沉。
                    4. 做 6 轮，越做越安静，不抢速度。
                    """
                ),
                TrainingStep(
                    id: "hum",
                    title: "闭口轻哼",
                    seconds: 45,
                    cue: "声音往前放，唇边有振动。",
                    instruction: """
                    1. 闭口发“嗯——”，音量控制在 3 成。
                    2. 想象声音从鼻前和唇边出去，不往喉咙里压。
                    3. 每次 3 到 4 秒，停一下再来。
                    4. 目标不是好听，是开口前先把声音放稳。
                    """
                ),
                TrainingStep(
                    id: "sentence",
                    title: "一句话落尾",
                    seconds: 75,
                    cue: "句尾慢半拍，最后一个字落住。",
                    instruction: """
                    1. 先轻声读：这项工作我们先按既定节奏推进。
                    2. 每读一次，只改一个点：句尾不要飘、不要急收。
                    3. 逗号前稍停，最后两个字放慢半拍。
                    4. 用会议里的真实音量读，不用播音腔。
                    """
                )
            ]
        )
    }

    if minutes >= 10 {
        let totalSeconds = minutes * 60
        let relaxSeconds = totalSeconds * 15 / 100
        let flowSeconds = totalSeconds * 20 / 100
        let frontSeconds = totalSeconds * 20 / 100
        let toneSeconds = totalSeconds * 25 / 100
        let transferSeconds = totalSeconds - relaxSeconds - flowSeconds - frontSeconds - toneSeconds

        return TrainingPlan(
            id: "standard",
            title: "\(minutes) 分钟标准稳声包",
            minutes: minutes,
            goal: "放松、气息、共鸣、短句迁移完整跑一遍。",
            reason: recentCount == 0 ? "先建立一个低压力闭环，不追求播音腔。" : "你本周已有记录，今天继续把稳定感接上。",
            steps: [
                TrainingStep(
                    id: "relax",
                    title: "身体归位",
                    seconds: relaxSeconds,
                    cue: "下颌松，肩颈松，身体不抢声音。",
                    instruction: """
                    1. 坐姿时坐骨落稳，站姿时脚掌踩实。
                    2. 下巴微收，不仰头，不把脖子往前伸。
                    3. 肩膀向后轻转，再自然落下。
                    4. 轻轻张嘴再合上，确认牙关没有咬紧。
                    """
                ),
                TrainingStep(
                    id: "flow",
                    title: "S 气流",
                    seconds: flowSeconds,
                    cue: "气流细、长、不断，中间不塌。",
                    instruction: """
                    1. 吸气不用多，够用就好，肩膀不要抬。
                    2. 轻吐“s——”，像轮胎慢慢放气。
                    3. 每次吐到还剩一点气就停，不要硬撑到憋。
                    4. 重点听气流是否均匀，不追求吐得特别长。
                    """
                ),
                TrainingStep(
                    id: "front",
                    title: "共鸣靠前",
                    seconds: frontSeconds,
                    cue: "声音在唇齿前方，喉咙只是通过。",
                    instruction: """
                    1. 先闭口轻哼“嗯——”，找鼻前振动。
                    2. 接着读“嗯-妈-明”，每个字都轻轻送出来。
                    3. 不要压低嗓音，不要为了稳而变沉。
                    4. 如果声音卡住，回到闭口轻哼再继续。
                    """
                ),
                TrainingStep(
                    id: "tone",
                    title: "公务短句",
                    seconds: toneSeconds,
                    cue: "每句话有起点、有停顿、有落点。",
                    instruction: """
                    1. 练句：我们把重点再压实一点，确保结果可检查。
                    2. 先慢读一遍，逗号处停半拍。
                    3. 第二遍用正常工作音量，句尾不要上扬。
                    4. 第三遍想象对面有人，语气要稳、清楚、可执行。
                    """
                ),
                TrainingStep(
                    id: "transfer",
                    title: "真实表达迁移",
                    seconds: transferSeconds,
                    cue: "像真实开会一样说，但节奏比平时稳一点。",
                    instruction: """
                    1. 选一个你今天真的要说的工作事项。
                    2. 用三句话讲清：背景、判断、下一步。
                    3. 每句话说完停半拍，让对方有接收空间。
                    4. 录一遍或默读一遍，记住最自然的一版。
                    """
                )
            ]
        )
    }

    let totalSeconds = minutes * 60
    let postureSeconds = max(45, totalSeconds / 5)
    let inhaleSeconds = max(60, totalSeconds / 3)
    let sentenceSeconds = totalSeconds - postureSeconds - inhaleSeconds

    return TrainingPlan(
        id: "breath",
        title: "\(minutes) 分钟气息稳定包",
        minutes: minutes,
        goal: "声音不断、不虚、不前冲后塌。",
        reason: "你最近 breath 练得相对少。今天只抓一个目标：声音不断、不虚、不前冲后塌。",
        steps: [
            TrainingStep(
                id: "posture",
                title: "姿态归位",
                seconds: postureSeconds,
                cue: "胸口不顶，后背展开，声音有空间。",
                instruction: """
                1. 坐直但不要僵，背部像被轻轻拉长。
                2. 下巴微收，眼睛看正前方，不低头压喉咙。
                3. 肩膀自然落下，胸口不要往外顶。
                4. 先无声呼吸两轮，再进入发声。
                """
            ),
            TrainingStep(
                id: "inhale",
                title: "低位吸气",
                seconds: inhaleSeconds,
                cue: "腰腹轻轻撑开，呼气不断线。",
                instruction: """
                1. 鼻吸 2 秒，腰腹轻轻向外撑，不吸到满。
                2. 口呼 4 秒，气流像一条细线。
                3. 呼气时不要收腹太猛，也不要用喉咙顶住。
                4. 每轮结束停半拍，让身体自己回弹。
                """
            ),
            TrainingStep(
                id: "sentence",
                title: "单句稳定",
                seconds: sentenceSeconds,
                cue: "一句话一口气，开头不冲，结尾不虚。",
                instruction: """
                1. 练句：今天我们先把这个问题说清楚。
                2. 先小声读，确保每个字都不挤。
                3. 再用正常音量读，开头轻一点，句尾落住。
                4. 最后换成你自己的工作句，保持同样节奏。
                """
            )
        ]
    )
}

private func timeText(_ seconds: Int) -> String {
    let min = seconds / 60
    let sec = seconds % 60
    return String(format: "%02d:%02d", min, sec)
}

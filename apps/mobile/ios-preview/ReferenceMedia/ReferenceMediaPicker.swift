import AVFoundation
import CoreTransferable
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct ReferenceMediaPicker: View {
    @Binding var selectedMedia: ReferenceMedia?
    var onMediaSelected: (ReferenceMedia) -> Void

    @State private var showsLegacyPicker = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if #available(iOS 16.0, *) {
                ModernReferenceMediaPickerButton { result in
                    handle(result)
                }
            } else {
                Button {
                    showsLegacyPicker = true
                } label: {
                    Label("选择参考媒体", systemImage: "photo.on.rectangle")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.black.opacity(0.62), in: Capsule())
                }
                .sheet(isPresented: $showsLegacyPicker) {
                    LegacyPHPickerView { result in
                        handle(result)
                    }
                }
            }
        }
        .alert("参考媒体加载失败", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("好", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func handle(_ result: Result<ReferenceMedia, Error>) {
        switch result {
        case let .success(media):
            apply(media)
        case let .failure(error):
            errorMessage = error.localizedDescription
        }
    }

    private func apply(_ media: ReferenceMedia) {
        selectedMedia = media
        onMediaSelected(media)
    }
}

@available(iOS 16.0, *)
private struct ModernReferenceMediaPickerButton: View {
    let completion: (Result<ReferenceMedia, Error>) -> Void

    @State private var selectedItem: PhotosPickerItem?

    var body: some View {
        PhotosPicker(
            selection: $selectedItem,
            matching: .any(of: [.images, .videos]),
            preferredItemEncoding: .current
        ) {
            Label("选择参考媒体", systemImage: "photo.on.rectangle")
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.black.opacity(0.62), in: Capsule())
        }
        .onChange(of: selectedItem) { item in
            guard let item else { return }
            Task {
                await load(item)
            }
        }
    }

    private func load(_ item: PhotosPickerItem) async {
        do {
            if item.supportedContentTypes.contains(where: { $0.conforms(to: .image) }),
               let data = try await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                await MainActor.run {
                    completion(.success(.image(image)))
                }
                return
            }

            if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) || $0.conforms(to: .video) || $0.conforms(to: .audiovisualContent) }),
               let movie = try await item.loadTransferable(type: PickedMovie.self) {
                let player = AVPlayer(url: movie.url)
                await MainActor.run {
                    completion(.success(ReferenceMedia.makeVideo(url: movie.url, player: player)))
                }
                return
            }

            await MainActor.run {
                completion(.failure(ReferenceMediaPickerError.unsupportedMedia))
            }
        } catch {
            await MainActor.run {
                completion(.failure(error))
            }
        }
    }
}

@available(iOS 16.0, *)
private struct PickedMovie: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            let copiedURL = try TempFileStore.copyTemporaryFile(from: received.file, suggestedExtension: "mov")
            return PickedMovie(url: copiedURL)
        }
    }
}

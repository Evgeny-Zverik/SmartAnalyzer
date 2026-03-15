import AppKit
import Foundation
import ImageIO
import Vision

struct OCRLine: Codable {
    let text: String
    let confidence: Double
}

struct OCRResult: Codable {
    let recognized_text: String
    let confidence: Double
    let page_count: Int
    let lines: [OCRLine]
}

enum OCRScriptError: Error {
    case badArguments
    case cannotLoadImage
}

func loadCGImages(from path: String) throws -> [CGImage] {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
        throw OCRScriptError.cannotLoadImage
    }

    let count = CGImageSourceGetCount(source)
    guard count > 0 else {
        throw OCRScriptError.cannotLoadImage
    }

    var images: [CGImage] = []
    for index in 0..<count {
        if let image = CGImageSourceCreateImageAtIndex(source, index, nil) {
            images.append(image)
        }
    }
    guard !images.isEmpty else {
        throw OCRScriptError.cannotLoadImage
    }
    return images
}

func recognizeLines(from image: CGImage) throws -> [OCRLine] {
    var requestError: Error?
    var recognized: [OCRLine] = []

    let request = VNRecognizeTextRequest { request, error in
        requestError = error
        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            return
        }
        for observation in observations {
            guard let candidate = observation.topCandidates(1).first else {
                continue
            }
            let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty {
                continue
            }
            recognized.append(
                OCRLine(
                    text: text,
                    confidence: Double(candidate.confidence)
                )
            )
        }
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["ru-RU", "en-US"]
    request.minimumTextHeight = 0.015

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    if let requestError {
        throw requestError
    }

    return recognized
}

func main() throws {
    guard CommandLine.arguments.count >= 2 else {
        throw OCRScriptError.badArguments
    }

    let path = CommandLine.arguments[1]
    let images = try loadCGImages(from: path)

    var allLines: [OCRLine] = []
    for image in images {
        let lines = try recognizeLines(from: image)
        allLines.append(contentsOf: lines)
    }

    let recognizedText = allLines.map(\.text).joined(separator: "\n")
    let confidence: Double
    if allLines.isEmpty {
        confidence = 0
    } else {
        confidence = allLines.map(\.confidence).reduce(0, +) / Double(allLines.count)
    }

    let result = OCRResult(
        recognized_text: recognizedText,
        confidence: confidence,
        page_count: images.count,
        lines: allLines
    )

    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(result)
    FileHandle.standardOutput.write(data)
}

do {
    try main()
} catch {
    let payload = [
        "error": String(describing: error)
    ]
    let data = try JSONSerialization.data(withJSONObject: payload, options: [])
    FileHandle.standardOutput.write(data)
    exit(1)
}

// Local-only OCR for reference glyph height. It never rewrites input images.
import Foundation
import Vision
import ImageIO

let root = URL(fileURLWithPath: CommandLine.arguments[1])
let files = try FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("inputs"), includingPropertiesForKeys: nil).filter { $0.pathExtension == "jpg" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
var results: [[String: Any]] = []
for file in files {
    autoreleasepool {
        let source = CGImageSourceCreateWithURL(file as CFURL, nil)!
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)! as NSDictionary
        let width = properties[kCGImagePropertyPixelWidth] as! Double
        let height = properties[kCGImagePropertyPixelHeight] as! Double
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.006
        do {
            try VNImageRequestHandler(url: file).perform([request])
            var observations: [[String: Any]] = []
            for observation in request.results ?? [] {
                guard let text = observation.topCandidates(1).first, text.confidence >= 0.6 else { continue }
                let han = text.string.unicodeScalars.filter { (0x3400...0x9FFF).contains(Int($0.value)) }.count
                guard han >= 2 else { continue }
                let box = observation.boundingBox
                let w = box.width * width, h = box.height * height
                let glyph = h > w * 1.8 ? h / Double(han) : h
                guard glyph >= min(width,height) * 0.005, glyph <= min(width,height) * 0.05 else { continue }
                guard box.midY > 0.08, box.midY < 0.96 else { continue }
                observations.append(["text":text.string,"confidence":text.confidence,"glyphHeight":glyph,"x":box.minX,"y":1-box.maxY,"width":box.width,"height":box.height])
            }
            let heights = observations.compactMap { $0["glyphHeight"] as? Double }.sorted()
            let median: Any = heights.isEmpty ? NSNull() : heights[heights.count / 2]
            let raw = (request.results ?? []).prefix(10).map { item -> [String:Any] in
                let candidate = item.topCandidates(1).first
                return ["text":candidate?.string ?? "", "confidence":candidate?.confidence ?? 0,
                        "pixelWidth":item.boundingBox.width * width,"pixelHeight":item.boundingBox.height * height]
            }
            results.append(["id":Int(file.deletingPathExtension().lastPathComponent)!,"previewWidth":width,"previewHeight":height,"referenceHeight":median,"observations":observations,"raw":raw])
            print("\(file.lastPathComponent): \(observations.count) reliable text lines")
        } catch {
            results.append(["id":Int(file.deletingPathExtension().lastPathComponent)!,"error":String(describing:error),"observations":[]])
            print("\(file.lastPathComponent): OCR unavailable")
        }
    }
}
try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted,.sortedKeys]).write(to: root.appendingPathComponent("text-reference.json"))

import Foundation

enum JSONCoding {
  static let dateStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

  static func encoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    encoder.dateEncodingStrategy = .custom { date, encoder in
      var container = encoder.singleValueContainer()
      try container.encode(date.formatted(dateStyle))
    }
    return encoder
  }

  static func decoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
      try dateStyle.parse(decoder.singleValueContainer().decode(String.self))
    }
    return decoder
  }
}

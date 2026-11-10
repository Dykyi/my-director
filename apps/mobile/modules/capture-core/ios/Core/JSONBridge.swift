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

enum JSONBridge {
  static func object(_ value: some Encodable) throws -> [String: Any] {
    let data = try JSONCoding.encoder().encode(value)
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw EncodingError.invalidValue(value, .init(codingPath: [], debugDescription: "Expected a JSON object"))
    }
    return object
  }

  static func array(_ values: some Encodable) throws -> [[String: Any]] {
    let data = try JSONCoding.encoder().encode(values)
    guard let array = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      throw EncodingError.invalidValue(values, .init(codingPath: [], debugDescription: "Expected a JSON array of objects"))
    }
    return array
  }
}

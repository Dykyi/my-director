import Foundation

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

import Foundation

enum ConfigError: Error, Equatable, Sendable {
  case unknownKey(path: String)
  case wrongType(path: String, expected: String)
  case undecodable(path: String, reason: String)
  case invalid(problems: [String])

  var message: String {
    switch self {
    case .unknownKey(let path): "Unknown config key \(path)"
    case .wrongType(let path, let expected): "Config key \(path) must be \(expected)"
    case .undecodable(let path, let reason): "Config key \(path): \(reason)"
    case .invalid(let problems): problems.joined(separator: "; ")
    }
  }
}

enum ConfigResolver {
  static func resolve(overrides: [String: Any], defaults: CaptureConfig = .defaults) throws -> CaptureConfig {
    let merged = try merge(overrides, into: jsonObject(defaults), path: [])
    let config = try decode(merged)
    let problems = ConfigValidator.problems(in: config)
    guard problems.isEmpty else { throw ConfigError.invalid(problems: problems) }
    return config
  }

  private static func jsonObject(_ config: CaptureConfig) throws -> [String: Any] {
    let data = try JSONEncoder().encode(config)
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      preconditionFailure("CaptureConfig encodes to a JSON object")
    }
    return object
  }

  private static func merge(_ overrides: [String: Any], into base: [String: Any], path: [String]) throws -> [String: Any] {
    var merged = base
    for (key, value) in overrides {
      let keyPath = path + [key]
      guard let current = base[key] else {
        throw ConfigError.unknownKey(path: keyPath.joined(separator: "."))
      }
      let expected = JSONKind(current)
      guard JSONKind(value) == expected else {
        throw ConfigError.wrongType(path: keyPath.joined(separator: "."), expected: expected.rawValue)
      }
      if let currentObject = current as? [String: Any], let valueObject = value as? [String: Any] {
        merged[key] = try merge(valueObject, into: currentObject, path: keyPath)
      } else {
        merged[key] = value
      }
    }
    return merged
  }

  private static func decode(_ object: [String: Any]) throws -> CaptureConfig {
    let data = try JSONSerialization.data(withJSONObject: object)
    do {
      return try JSONDecoder().decode(CaptureConfig.self, from: data)
    } catch DecodingError.dataCorrupted(let context), DecodingError.typeMismatch(_, let context) {
      throw ConfigError.undecodable(path: context.codingPath.dottedPath, reason: context.debugDescription)
    }
  }
}

private enum JSONKind: String {
  case object, string, boolean, number, other

  init(_ value: Any) {
    switch value {
    case is [String: Any]: self = .object
    case is String: self = .string
    case let number as NSNumber where CFGetTypeID(number) == CFBooleanGetTypeID(): self = .boolean
    case let number as NSNumber where number.doubleValue.isFinite: self = .number
    default: self = .other
    }
  }
}

private extension [any CodingKey] {
  var dottedPath: String { map(\.stringValue).joined(separator: ".") }
}

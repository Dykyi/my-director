/// A rejoin reuses the token from Start, which carries the name from before a rename,
/// and a rename made while the room was not connected waits here for the next connect.
struct CallNameMemory: Sendable {
  private var latest: String?

  mutating func remember(_ name: String) {
    latest = name
  }

  func nameToRestore(tokenName: String?) -> String? {
    guard let latest, latest != tokenName else { return nil }
    return latest
  }
}

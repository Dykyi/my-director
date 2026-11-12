/// The phone hears the interviewer only: other phones in the room stay out of its speaker and its file,
/// and nothing plays while it is paused. Phones join as `iphone` or `iphone-<install id>`.
enum CallListening {
  private static let phoneIdentity = "iphone"

  static func listens(to identity: String, isAudio: Bool, paused: Bool) -> Bool {
    isAudio && !paused && !isPhone(identity)
  }

  private static func isPhone(_ identity: String) -> Bool {
    identity == phoneIdentity || identity.hasPrefix(phoneIdentity + "-")
  }
}

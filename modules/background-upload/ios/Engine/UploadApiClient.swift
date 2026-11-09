import Foundation

struct UploadApiClient {
  struct HTTPError: LocalizedError {
    var status: Int
    var body: String
    var errorDescription: String? { "Upload API answered HTTP \(status): \(body)" }
  }

  private static let errorBodyLimit = 512

  let api: UploadApi

  func createUpload(_ body: CreateUploadRequest) async throws -> CreateUploadResponse {
    var request = try makeRequest(path: ["uploads"], method: "POST")
    request.httpBody = try JSONEncoder().encode(body)
    return try JSONDecoder().decode(CreateUploadResponse.self, from: try await send(request))
  }

  func abortUpload(uploadId: String, key: String) async throws {
    _ = try await send(try makeRequest(path: ["uploads", uploadId], method: "DELETE", key: key))
  }

  func completeRequest(uploadId: String) throws -> URLRequest {
    try makeRequest(path: ["uploads", uploadId, "complete"], method: "POST")
  }

  private func makeRequest(path: [String], method: String, key: String? = nil) throws -> URLRequest {
    let encodedPath = path.compactMap { $0.addingPercentEncoding(withAllowedCharacters: .alphanumerics) }.joined(separator: "/")
    guard var components = URLComponents(string: "\(api.baseUrl)/\(encodedPath)") else { throw URLError(.badURL) }
    if let key { components.queryItems = [URLQueryItem(name: "key", value: key)] }
    guard let url = components.url else { throw URLError(.badURL) }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("Bearer \(api.token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    return request
  }

  private func send(_ request: URLRequest) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      throw HTTPError(status: status, body: String(decoding: data.prefix(Self.errorBodyLimit), as: UTF8.self))
    }
    return data
  }
}

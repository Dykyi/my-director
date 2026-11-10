const POLL_MS = 5_000;
const [uploadId, key] = process.argv.slice(2);
const { EXPO_PUBLIC_UPLOAD_API_URL: api, EXPO_PUBLIC_UPLOAD_API_TOKEN: token } = process.env;
if (!uploadId || !key || !api || !token) {
  console.error('Usage: yarn upload-api watch-parts <uploadId> <key>');
  process.exit(1);
}

const seen = new Set();
for (;;) {
  const url = `${api}/uploads/${encodeURIComponent(uploadId)}/parts?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const time = new Date().toISOString().slice(11, 19);
  if (!response.ok) {
    console.log(`${time} HTTP ${response.status}`);
  } else {
    const { parts } = await response.json();
    const fresh = parts.filter((part) => !seen.has(part.partNumber));
    fresh.forEach((part) => seen.add(part.partNumber));
    const bytes = parts.reduce((sum, part) => sum + part.size, 0);
    console.log(
      `${time} parts ${parts.length}, ${(bytes / 1_048_576).toFixed(1)} MB${fresh.length ? `, new: ${fresh.map((p) => p.partNumber).join(' ')}` : ''}`,
    );
  }
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}

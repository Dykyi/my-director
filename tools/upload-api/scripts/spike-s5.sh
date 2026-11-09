#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
set -a && . ./.env.local && set +a
API="$EXPO_PUBLIC_UPLOAD_API_URL"
AUTH="Authorization: Bearer $EXPO_PUBLIC_UPLOAD_API_TOKEN"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
PART_SIZE=$((5 * 1024 * 1024))
head -c $((PART_SIZE + 1000)) /dev/urandom > "$WORK/file.bin"
split -b "$PART_SIZE" -a 1 "$WORK/file.bin" "$WORK/part-"
MD5_A=$(openssl md5 -binary "$WORK/part-a" | base64)
MD5_B=$(openssl md5 -binary "$WORK/part-b" | base64)
KEY="spike/s5-$(date +%s).bin"
SIZE=$(stat -f %z "$WORK/file.bin")

CREATE=$(curl -fsS -X POST "$API/uploads" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$KEY\",\"size\":$SIZE,\"partSize\":$PART_SIZE,\"partMd5s\":[\"$MD5_A\",\"$MD5_B\"]}")
UPLOAD_ID=$(node -p "JSON.parse(process.argv[1]).uploadId" "$CREATE")
URL_A=$(node -p "JSON.parse(process.argv[1]).parts[0].url" "$CREATE")
URL_B=$(node -p "JSON.parse(process.argv[1]).parts[1].url" "$CREATE")
echo "key $KEY, uploadId $UPLOAD_ID"

put_part() {
  curl -fsS -D - -o /dev/null -X PUT "$1" -H "Content-MD5: $2" --data-binary @"$3" \
    | awk -F': ' 'tolower($1)=="etag"{print $2}' | tr -d '\r'
}

complete() {
  local body
  body=$(node -p 'const [key, size, a, b] = process.argv.slice(1);
    JSON.stringify({ key, size: Number(size), parts: [{ partNumber: 1, etag: a }, { partNumber: 2, etag: b }] })' \
    "$KEY" "$SIZE" "$ETAG_A" "$ETAG_B")
  curl -sS -w '\nHTTP %{http_code}\n' -X POST "$API/uploads/$UPLOAD_ID/complete" -H "$AUTH" \
    -H 'Content-Type: application/json' -d "$body"
}

echo "1. Part 2 with the wrong body must be rejected with 400 (B2's error body follows):"
curl -sS -w '\nHTTP %{http_code}\n' -X PUT "$URL_B" -H "Content-MD5: $MD5_B" --data-binary @"$WORK/part-a"

echo "2. Both parts with the right bodies must return 200 and an ETag (raw headers, then the parts' hex MD5):"
ETAG_A=$(put_part "$URL_A" "$MD5_A" "$WORK/part-a")
ETAG_B=$(put_part "$URL_B" "$MD5_B" "$WORK/part-b")
echo "   ETag:    $ETAG_A $ETAG_B"
echo "   MD5 hex: $(openssl md5 -r "$WORK/part-a" | cut -d' ' -f1) $(openssl md5 -r "$WORK/part-b" | cut -d' ' -f1)"

echo "3. The Worker must list both parts (ListParts, as watch-parts.mjs uses it):"
curl -fsS "$API/uploads/$UPLOAD_ID/parts?key=$KEY" -H "$AUTH"
echo

echo "4. Complete must be verified with the exact size ($SIZE):"
complete
echo "5. A repeated complete must still be verified:"
complete

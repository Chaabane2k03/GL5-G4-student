#!/bin/sh
set -eu

NEXUS_URL="${NEXUS_URL:-http://nexus:8081}"
NEXUS_USER="${NEXUS_USER:-admin}"
NEXUS_PASSWORD="${NEXUS_PASSWORD:-admin123}"
REPOSITORY="${NEXUS_DOCKER_REPOSITORY:-docker-hosted}"

until curl -fsS -u "$NEXUS_USER:$NEXUS_PASSWORD" "$NEXUS_URL/service/rest/v1/status" >/dev/null; do
  echo "Waiting for Nexus..."
  sleep 5
done

EULA_FILE="/tmp/nexus-eula.json"
EULA_ACCEPTED="/tmp/nexus-eula-accepted.json"
curl -fsS -u "$NEXUS_USER:$NEXUS_PASSWORD" -H "Accept: application/json" "$NEXUS_URL/service/rest/v1/system/eula" > "$EULA_FILE"

if grep -q '"accepted"[[:space:]]*:[[:space:]]*false' "$EULA_FILE"; then
  sed 's/"accepted"[[:space:]]*:[[:space:]]*false/"accepted" : true/' "$EULA_FILE" > "$EULA_ACCEPTED"
  curl -fsS -u "$NEXUS_USER:$NEXUS_PASSWORD" \
    -H "Content-Type: application/json; charset=UTF-8" \
    --data-binary "@$EULA_ACCEPTED" \
    "$NEXUS_URL/service/rest/v1/system/eula" >/dev/null
fi

if curl -fsS -u "$NEXUS_USER:$NEXUS_PASSWORD" -o /dev/null "$NEXUS_URL/service/rest/v1/repositories/docker/hosted/$REPOSITORY"; then
  echo "Nexus repository $REPOSITORY already exists."
  exit 0
fi

curl -fsS -u "$NEXUS_USER:$NEXUS_PASSWORD" \
  -H "Content-Type: application/json" \
  -X POST "$NEXUS_URL/service/rest/v1/repositories/docker/hosted" \
  -d "{
    \"name\": \"$REPOSITORY\",
    \"online\": true,
    \"storage\": {
      \"blobStoreName\": \"default\",
      \"strictContentTypeValidation\": true,
      \"writePolicy\": \"allow_once\"
    },
    \"docker\": {
      \"v1Enabled\": false,
      \"forceBasicAuth\": true,
      \"httpPort\": 8087,
      \"httpsPort\": null,
      \"subdomain\": null
    },
    \"component\": {
      \"proprietaryComponents\": true
    }
  }"

echo "Nexus repository $REPOSITORY created on port 8087."

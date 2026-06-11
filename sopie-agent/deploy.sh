#!/usr/bin/env bash
# Deploy sopie-agent to AgentBase Runtime.
# Usage: bash deploy.sh [TAG]   (default TAG = v<timestamp>)
#
# Prerequisites:
#   - .greennode.json with valid client_id / client_secret
#   - .env with LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, SUPABASE_URL
#   - Docker daemon running

set -euo pipefail

RUNTIME_ID="runtime-5d58efe5-4e86-4dfc-882c-068a8705751a"
REPO="vcr.vngcloud.vn/111480-abp111928/sopie-agent"
FLAVOR="runtime-s2-general-2x4"
TAG="${1:-v$(date +%Y%m%d%H%M%S)}"
IMAGE="$REPO:$TAG"
SCRIPTS="../.claude/skills/agentbase/scripts"

echo "=== sopie-agent deploy: $IMAGE ==="

# 1. Login to AgentBase Container Registry
echo "[1/4] Docker login to AgentBase CR..."
bash "$SCRIPTS/cr.sh" credentials docker-login

# 2. Build
echo "[2/4] Building image ($IMAGE)..."
docker build --platform linux/amd64 -t "$IMAGE" .

# 3. Push
echo "[3/4] Pushing image..."
docker push "$IMAGE"

# 4. Update runtime — always pass --from-cr + --env-file to avoid imageAuth/env loss
echo "[4/4] Updating runtime $RUNTIME_ID..."
bash "$SCRIPTS/runtime.sh" update "$RUNTIME_ID" \
  --image "$IMAGE" \
  --flavor "$FLAVOR" \
  --from-cr \
  --env-file .env

echo ""
echo "Deploy complete — image: $IMAGE"
echo "Console: https://aiplatform.console.vngcloud.vn/agent-runtime?tab=runtime"

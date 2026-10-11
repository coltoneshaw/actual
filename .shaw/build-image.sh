#!/usr/bin/env bash
# Build the fork's server+web image from the current checkout of shaw/main
# with upstream's own Dockerfile, and optionally push it.
#
#   .shaw/build-image.sh            # build only
#   .shaw/build-image.sh --push     # build and push (uses $DOCKER_CONFIG)
#
# Tag: <yyyy.mm.dd>-<short sha>, e.g. 2026.10.10-0efd540.
set -euo pipefail

REPO=git.silverhollow.xyz/admin/actual
cd "$(git rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty; commit first so the tag matches the code." >&2
  exit 1
fi

TAG="$(date +%Y.%m.%d)-$(git rev-parse --short=7 HEAD)"

yarn build:server
docker buildx build --platform linux/amd64 \
  -f packages/sync-server/docker/ubuntu.Dockerfile \
  -t "$REPO:$TAG" --load .

if [[ "${1:-}" == "--push" ]]; then
  docker push "$REPO:$TAG"
fi
echo "$REPO:$TAG"

#!/usr/bin/env bash
# Deploy to production server from local machine.
# Usage: ./scripts/deploy-remote.sh
#
# Pushes current branch to GitHub (if behind) and runs deploy.sh on server.

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@77.95.203.229}"
REMOTE_PATH="${DEPLOY_PATH:-/opt/smartanalyzer}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Current branch is '$BRANCH', not 'main'."
  read -p "Continue deploy from this branch? [y/N] " -n 1 -r; echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Uncommitted changes. Commit or stash first."
  git status -s
  exit 1
fi

echo "==> git push origin $BRANCH"
git push origin "$BRANCH"

echo
echo "==> ssh $SERVER deploy"
ssh -t "$SERVER" "cd $REMOTE_PATH && ./scripts/deploy.sh"

echo
echo "✅ Deploy finished: https://smartanalyzer.ru"

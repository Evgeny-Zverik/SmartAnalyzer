#!/usr/bin/env bash
# Deploy to production server from local machine.
# Usage: ./scripts/deploy-remote.sh   (or: pnpm deploy)

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@77.95.203.229}"
REMOTE_PATH="${DEPLOY_PATH:-/opt/smartanalyzer}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RESET=$'\033[0m'

if [ "$BRANCH" != "main" ]; then
  printf "%b⚠️  Current branch is '%s', not 'main'.%b\n" "$YELLOW" "$BRANCH" "$RESET"
  read -p "Continue deploy from this branch? [y/N] " -n 1 -r; echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  printf "%b❌ Uncommitted changes. Commit or stash first.%b\n" "$RED" "$RESET"
  git status -s
  exit 1
fi

# Fetch what server currently has deployed
printf "%b==>%b Checking server state\n" "$BLUE" "$RESET"
REMOTE_SHA=$(ssh "$SERVER" "cd $REMOTE_PATH && git rev-parse HEAD")
LOCAL_SHA=$(git rev-parse HEAD)

# --- Env sync: infra/env/*.env.prod → server:infra/env/*.env ---
ENV_CHANGED=0
ENV_DIFF_OUTPUT=""
shopt -s nullglob
for local_prod in infra/env/*.env.prod; do
  remote_name="$(basename "${local_prod%.prod}")"
  remote_path="$REMOTE_PATH/infra/env/$remote_name"
  remote_content=$(ssh "$SERVER" "cat $remote_path 2>/dev/null || true")
  local_content=$(cat "$local_prod")
  if [ "$remote_content" != "$local_content" ]; then
    ENV_CHANGED=1
    ENV_DIFF_OUTPUT+="  %b~ $remote_name%b\n"
    diff_lines=$(diff <(echo "$remote_content") <(echo "$local_content") | grep -E '^[<>]' | head -20 || true)
    [ -n "$diff_lines" ] && ENV_DIFF_OUTPUT+="$(echo "$diff_lines" | sed 's/^/      /')\n"
  fi
done
shopt -u nullglob

if [ "$REMOTE_SHA" = "$LOCAL_SHA" ] && [ "$ENV_CHANGED" = "0" ]; then
  printf "%bAlready up to date on server (%s).%b\n" "$DIM" "${LOCAL_SHA:0:7}" "$RESET"
  exit 0
fi

if [ "$ENV_CHANGED" = "1" ]; then
  printf "%bEnv changes:%b\n" "$BOLD" "$RESET"
  printf "$ENV_DIFF_OUTPUT" "$YELLOW" "$RESET"
  echo
fi

if [ "$REMOTE_SHA" != "$LOCAL_SHA" ]; then
  printf "%b==>%b Deploying %s → %s\n" "$BLUE" "$RESET" "${REMOTE_SHA:0:7}" "${LOCAL_SHA:0:7}"
else
  printf "%b==>%b Deploying env-only change (git %s)\n" "$BLUE" "$RESET" "${LOCAL_SHA:0:7}"
fi
echo

if [ "$REMOTE_SHA" != "$LOCAL_SHA" ]; then
  # Show commits being deployed
  printf "%bCommits:%b\n" "$BOLD" "$RESET"
  git log --pretty=format:"  %C(yellow)%h%C(reset) %s %C(dim)(%an)%C(reset)" "$REMOTE_SHA..$LOCAL_SHA"
  echo
  echo

  # Show file changes with colors: A=green, D=red, M=yellow, R=blue
  printf "%bFile changes:%b\n" "$BOLD" "$RESET"
  git diff --name-status "$REMOTE_SHA..$LOCAL_SHA" | while IFS=$'\t' read -r status path rest; do
    case "$status" in
      A*) printf "  %b+ %s%b\n" "$GREEN" "$path" "$RESET" ;;
      D*) printf "  %b- %s%b\n" "$RED" "$path" "$RESET" ;;
      M*) printf "  %b~ %s%b\n" "$YELLOW" "$path" "$RESET" ;;
      R*) printf "  %b→ %s → %s%b\n" "$BLUE" "$path" "$rest" "$RESET" ;;
      *)  printf "  %s %s\n" "$status" "$path" ;;
    esac
  done
  echo

  # Push new commits
  printf "%b==>%b git push origin %s\n" "$BLUE" "$RESET" "$BRANCH"
  git push origin "$BRANCH"
  echo
fi

# Sync env files (if any changed)
if [ "$ENV_CHANGED" = "1" ]; then
  printf "%b==>%b Syncing env files\n" "$BLUE" "$RESET"
  for local_prod in infra/env/*.env.prod; do
    remote_name="$(basename "${local_prod%.prod}")"
    scp -q "$local_prod" "$SERVER:$REMOTE_PATH/infra/env/$remote_name"
    printf "  %b✓%b %s\n" "$GREEN" "$RESET" "$remote_name"
  done
  echo
fi

printf "%b==>%b Running deploy on server\n" "$BLUE" "$RESET"
if [ "$REMOTE_SHA" = "$LOCAL_SHA" ] && [ "$ENV_CHANGED" = "1" ]; then
  # Env-only change: just recreate containers to pick up new env
  ssh -t "$SERVER" "cd $REMOTE_PATH && docker compose -f docker-compose.prod.yml up -d --force-recreate"
else
  ssh -t "$SERVER" "cd $REMOTE_PATH && ./scripts/deploy.sh"
fi

echo
printf "%b✅ Deployed %s%b → %bhttps://smartanalyzer.ru%b\n" "$GREEN" "${LOCAL_SHA:0:7}" "$RESET" "$BLUE" "$RESET"

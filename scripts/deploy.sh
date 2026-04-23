#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git pull"
BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "Already up to date."
  exit 0
fi

CHANGED=$(git diff --name-only "$BEFORE" "$AFTER")
echo "Changed files:"
echo "$CHANGED" | sed 's/^/  /'

need_build_backend=false
need_build_frontend=false
need_compose_up=false
need_migrate=false
need_caddy_reload=false

while IFS= read -r f; do
  case "$f" in
    backend/Dockerfile|backend/pyproject.toml)
      need_build_backend=true ;;
    frontend/Dockerfile|frontend/package.json|frontend/pnpm-lock.yaml)
      need_build_frontend=true ;;
    docker-compose.yml)
      need_compose_up=true ;;
    Caddyfile)
      need_caddy_reload=true ;;
    backend/alembic/versions/*)
      need_migrate=true ;;
  esac
done <<< "$CHANGED"

if $need_build_backend; then
  echo "==> rebuild backend"
  docker compose build backend
  need_compose_up=true
fi

if $need_build_frontend; then
  echo "==> rebuild frontend"
  docker compose build frontend
  need_compose_up=true
fi

if $need_compose_up; then
  echo "==> compose up -d"
  docker compose up -d
fi

if $need_caddy_reload; then
  echo "==> reload caddy"
  docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
fi

if $need_migrate; then
  echo "==> alembic upgrade head"
  docker compose exec backend alembic upgrade head
fi

echo "==> status"
docker compose ps
echo
echo "Deploy done: $BEFORE -> $AFTER"

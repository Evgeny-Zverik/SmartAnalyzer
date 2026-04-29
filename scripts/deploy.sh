#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

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
    backend/alembic/versions/*)
      need_build_backend=true
      need_migrate=true ;;
    backend/*|backend/**)
      need_build_backend=true ;;
    frontend/*|frontend/**)
      need_build_frontend=true ;;
    docker-compose.yml|docker-compose.prod.yml)
      need_compose_up=true ;;
    Caddyfile)
      need_caddy_reload=true ;;
  esac
done <<< "$CHANGED"

if $need_build_backend; then
  echo "==> rebuild backend"
  "${COMPOSE[@]}" build backend
  need_compose_up=true
fi

if $need_build_frontend; then
  echo "==> rebuild frontend"
  "${COMPOSE[@]}" build frontend
  need_compose_up=true
fi

if $need_compose_up; then
  echo "==> compose up -d"
  "${COMPOSE[@]}" up -d
fi

if $need_caddy_reload; then
  echo "==> reload caddy"
  "${COMPOSE[@]}" exec caddy caddy reload --config /etc/caddy/Caddyfile
fi

if $need_migrate; then
  echo "==> alembic upgrade head"
  "${COMPOSE[@]}" exec backend alembic upgrade head
fi

echo "==> status"
"${COMPOSE[@]}" ps
echo
echo "Deploy done: $BEFORE -> $AFTER"

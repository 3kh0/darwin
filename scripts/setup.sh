#!/usr/bin/env bash
set -euo pipefail

ESMBOT_DIR="services/esmbot-media"

cd "$(dirname "$0")/.."

if [ -d "$ESMBOT_DIR/.git" ]; then
  echo "esmBot already present, pulling latest..."
  git -C "$ESMBOT_DIR" pull --ff-only
elif [ -d "$ESMBOT_DIR" ] && [ "$(ls -A "$ESMBOT_DIR")" ]; then
  echo "ERROR: $ESMBOT_DIR exists and is non-empty but is not a git repo."
  echo "Remove it and re-run: rm -rf $ESMBOT_DIR"
  exit 1
else
  echo "Cloning esmBot into $ESMBOT_DIR ..."
  rm -rf "$ESMBOT_DIR"
  git clone --depth=1 https://github.com/esmBot/esmBot.git "$ESMBOT_DIR"
fi

echo "Installing API-only Dockerfile..."
cp "services/esmbot-media.Dockerfile" "$ESMBOT_DIR/Dockerfile"

if [ ! -f ".env" ]; then
  echo "Copying .env.example into .env"
  cp .env.example .env
fi

if [ ! -e "apps/web/.env" ]; then
  echo "Linking apps/web/.env → ../../.env ..."
  ln -s ../../.env apps/web/.env
fi

echo "Installing dependencies..."
pnpm install

echo "Setup done, consult the README for next steps."
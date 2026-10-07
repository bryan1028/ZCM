#!/usr/bin/env bash
# Fails if any <button> in src/ carries a name= attribute. Next 15's bundled React drops the clicked button's
# name/value from a server action's FormData, so such buttons silently do nothing. Use <ActionButton> instead.
cd "$(dirname "$0")/.."
if grep -rnE '<button[^>]*[ ]name=' src; then
  echo
  echo "✗ Found <button name=...>. Use <ActionButton action={...} fields={{...}}> from src/components/action-button.tsx instead."
  exit 1
fi
echo "✓ no <button name=...> in src/"

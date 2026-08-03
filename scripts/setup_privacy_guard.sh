#!/usr/bin/env sh
set -eu

repo_root=$(git rev-parse --show-toplevel)
git -C "$repo_root" config --local user.name sanbaruozhi
git -C "$repo_root" config --local user.email 192161019+sanbaruozhi@users.noreply.github.com
git -C "$repo_root" config --local core.hooksPath .githooks
printf '%s\n' 'Repository-local public Git identity and privacy hook enabled.'

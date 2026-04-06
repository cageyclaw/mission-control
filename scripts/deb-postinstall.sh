#!/bin/sh
set -eu

# electron-builder will run this script after installing the Linux package.
# Keep this script safe to run on systems that may not have these tools.

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q || true
fi

# Refresh GTK icon caches if available.
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  for dir in /usr/share/icons/hicolor /usr/local/share/icons/hicolor; do
    if [ -d "$dir" ]; then
      gtk-update-icon-cache -q -t -f "$dir" || true
    fi
  done
fi

exit 0


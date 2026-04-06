#!/bin/sh
set -eu

# Fix permissions on installed files (installed as root but must be readable by all users)
if [ -f /usr/share/applications/occ.desktop ]; then
  chmod 644 /usr/share/applications/occ.desktop || true
fi

# Fix icon permissions
if [ -d /usr/share/icons/hicolor ]; then
  find /usr/share/icons/hicolor -name "occ.png" -exec chmod 644 {} \; || true
fi

# Fix app directory permissions
if [ -d "/opt/OpenClaw Command Center" ]; then
  chmod -R a+r "/opt/OpenClaw Command Center" || true
  chmod a+x "/opt/OpenClaw Command Center/occ" || true
fi

# Refresh desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q || true
fi

# Refresh icon caches
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  for dir in /usr/share/icons/hicolor /usr/local/share/icons/hicolor; do
    if [ -d "$dir" ]; then
      gtk-update-icon-cache -q -t -f "$dir" || true
    fi
  done
fi

exit 0

#!/bin/bash
set -e

# Start Xvfb in the background
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99

# Wait a bit for Xvfb to be ready
sleep 1

# Start x11vnc in the background without password
x11vnc -display :99 -forever -shared -nopw &

# Start websockify to expose VNC over websocket on port 6080
websockify --web /usr/share/novnc 6080 127.0.0.1:5900 &

# Execute the passed command
exec "$@"

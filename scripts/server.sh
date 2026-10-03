#!/usr/bin/env bash
#==============================================================================
#  ADTC Website - Server Manager
#  Cara pakai:
#    bash scripts/server.sh start     -> jalankan server
#    bash scripts/server.sh stop      -> hentikan server
#    bash scripts/server.sh restart   -> stop + start
#    bash scripts/server.sh status    -> cek PID & port
#==============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/.server.pid"
PORT=3000

# Cari node binary
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "/usr/local/bin/node" ]; then
  NODE_BIN="/usr/local/bin/node"
elif [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
elif [ -x "/opt/cpanel/ea-nodejs16/root/usr/bin/node" ]; then
  NODE_BIN="/opt/cpanel/ea-nodejs16/root/usr/bin/node"
elif [ -x "/opt/cpanel/ea-nodejs18/root/usr/bin/node" ]; then
  NODE_BIN="/opt/cpanel/ea-nodejs18/root/usr/bin/node"
else
  NODE_BIN="node"
fi

# ---- Helpers ----

log()  { printf "\033[32m[ADTC]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[ADTC]\033[0m %s\n" "$*" >&2; }
err()  { printf "\033[31m[ADTC] ERROR\033[0m %s\n" "$*" >&2; }

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

get_pid() { [ -f "$PID_FILE" ] && cat "$PID_FILE" || echo ""; }

kill_port() {
  local pids
  pids="$(lsof -ti :"$PORT" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    for p in $pids; do
      kill "$p" 2>/dev/null || true
    done
    for i in 1 2 3; do
      if ! lsof -ti :"$PORT" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    pids="$(lsof -ti :"$PORT" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      for p in $pids; do
        kill -9 "$p" 2>/dev/null || true
      done
      sleep 0.5
    fi
  fi
}

clear_pid_file() { rm -f "$PID_FILE"; }

check_node() {
  if [ ! -x "$NODE_BIN" ]; then
    err "Node.js tidak ditemukan di $NODE_BIN"
    exit 1
  fi
}

write_pid() { echo "$1" > "$PID_FILE"; }

wait_for_port() {
  local i
  for i in $(seq 1 20); do
    sleep 1
    if lsof -ti :"$PORT" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

# ---- Commands ----

cmd_start() {
  log "Memulai server pada port $PORT ..."
  check_node

  if is_running; then
    local old_pid
    old_pid="$(get_pid)"
    warn "Proses lama terdeteksi (PID $old_pid), menghentikan..."
    kill_port
  fi
  clear_pid_file

  local i
  for i in $(seq 1 5); do
    if ! lsof -ti :"$PORT" >/dev/null 2>&1; then
      break
    fi
    warn "Port masih dipakai, menunggu..."
    sleep 1
  done
  kill_port

  cd "$PROJECT_ROOT"
  PORT="$PORT" NODE_ENV="${NODE_ENV:-development}" "$NODE_BIN" app.js > /dev/null 2>&1 &
  local srv_pid=$!

  write_pid "$srv_pid"
  log "Server dimulai (PID $srv_pid)..."

  if wait_for_port; then
    local new_pid
    new_pid="$(lsof -ti :"$PORT" | head -1)"
    write_pid "$new_pid"
    log "Server berjalan di http://localhost:$PORT  (PID $new_pid)"
    return 0
  else
    err "Port tidak terbuka dalam 20 detik."
    return 1
  fi
}

cmd_stop() {
  if is_running; then
    local pid
    pid="$(get_pid)"
    log "Menghentikan server (PID $pid)..."
    kill_port
    clear_pid_file
    log "Server dihentikan."
  else
    if lsof -ti :"$PORT" >/dev/null 2>&1; then
      log "Menghentikan proses di port $PORT..."
      kill_port
      clear_pid_file
      log "Server dihentikan."
    else
      warn "Server tidak berjalan."
      clear_pid_file
    fi
  fi
}

cmd_restart() {
  cmd_stop
  sleep 2
  cmd_start
}

cmd_status() {
  local pid
  pid="$(lsof -ti :"$PORT" 2>/dev/null | head -1)"
  if [ -n "$pid" ]; then
    log "Server berjalan -- PID: $pid"
    echo "   Port: $PORT"
    echo "   URL:  http://localhost:$PORT"
    local http_code
    http_code="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || echo "?")"
    echo "   HTTP: $http_code"
  else
    warn "Server tidak berjalan di port $PORT"
    if [ -f "$PID_FILE" ]; then
      warn "File PID ada tapi tidak cocok -- mungkin stale."
      echo "   PID di file: $(cat "$PID_FILE")"
      read -r -p "  Hapus file PID? [y/N] " ans
      if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
        clear_pid_file
        log "File PID dihapus."
      fi
    fi
  fi
}

case "${1:-start}" in
  start)   cmd_start   ;;
  stop)    cmd_stop    ;;
  restart) cmd_restart ;;
  status)  cmd_status  ;;
  *)
    echo "Penggunaan: bash scripts/server.sh {start|stop|restart|status}"
    exit 1
    ;;
esac

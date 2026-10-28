#!/bin/bash
set -e

HOST="adtcuadi@202.155.137.48"
APP_DIR="~/node-app"

echo "=== [1/4] SSH connection test ==="
ssh -o ConnectTimeout=5 -o BatchMode=yes "$HOST" "echo SSH OK" 2>&1

echo "=== [2/4] Check current .env DB credentials ==="
ssh "$HOST" "grep -E 'DB_USER|DB_NAME|DB_HOST|DB_PORT' $APP_DIR/.env 2>/dev/null || echo 'WARNING: .env not found at $APP_DIR/.env'"

echo "=== [3/4] Show last 20 lines of PM2 log ==="
ssh "$HOST" "pm2 logs adtc-app --lines 20 --nostream 2>/dev/null || echo 'PM2 not available or app not running'"

echo "=== [4/4] Restart & verify ==="
ssh "$HOST" "cd $APP_DIR && git pull origin main && pm2 restart adtc-app"

sleep 5
echo "=== Verifikasi HTTP status (from laptop) ==="
for path in "/" "/trainings" "/berita"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://adtcuad.id${path}")
  echo "  ${path} → HTTP ${CODE}"
done

echo ""
echo "Selesai. Kalau masih 500, cek: pm2 logs adtc-app --lines 50"

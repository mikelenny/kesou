#!/bin/bash
# 可搜 · 本地服务器启动器（macOS）
# 用途：PWA / Service Worker / PDF Worker 需要 http(s) 环境，直接双击 html 会受限。
# 关闭这个终端窗口即可停止服务器。

cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8765}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3，请先安装（macOS 可运行：xcode-select --install）"
  read -r -p "按回车退出…" _
  exit 1
fi

# 端口占用则自动 +1
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://localhost:${PORT}/%E5%8F%AF%E6%90%9C.html"

echo "────────────────────────────────────────────"
echo "  可搜 · 本地服务已启动"
echo "  本机访问：http://localhost:${PORT}/可搜.html"
echo ""
echo "  手机（同一 Wi-Fi）可访问："
for ip in $(ipconfig getifaddr en0 2>/dev/null) $(ipconfig getifaddr en1 2>/dev/null); do
  echo "    http://${ip}:${PORT}/可搜.html"
done
echo ""
echo "  提示：手机浏览器安装到主屏幕需要 HTTPS，"
echo "        建议部署到 GitHub Pages / Vercel / Netlify（见 离线版说明.md）。"
echo "  按 Ctrl+C 或关闭窗口停止服务。"
echo "────────────────────────────────────────────"

python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$PWD" &
SERVER_PID=$!

trap 'kill $SERVER_PID 2>/dev/null' INT TERM EXIT

sleep 1
open "$URL" 2>/dev/null

wait $SERVER_PID

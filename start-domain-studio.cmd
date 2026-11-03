@echo off
cd /d "%~dp0"
echo Domain Studio: http://127.0.0.1:8082/
echo Keep this window open. Press Ctrl+C to stop.
"%~dp0bin\domain-studio.exe" serve --addr 127.0.0.1:8082 --enable-watch --cors-origins http://127.0.0.1:8082 --log-format text
pause

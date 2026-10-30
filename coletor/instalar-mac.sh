#!/bin/bash
# Agenda o coletor para rodar todo dia no Mac (launchd). Uso: bash coletor/instalar-mac.sh [HORA] [MINUTO]
set -e
HORA="${1:-6}"
MINUTO="${2:-0}"
PROJETO="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
if [ -z "$NODE" ]; then echo "Node não encontrado. Instale em https://nodejs.org (versão 22 ou mais nova)."; exit 1; fi
mkdir -p "$HOME/.veiculomais" "$HOME/Library/LaunchAgents"
PLIST="$HOME/Library/LaunchAgents/br.com.veiculomais.coletor.plist"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>br.com.veiculomais.coletor</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$PROJETO/coletor/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJETO</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HORA</integer><key>Minute</key><integer>$MINUTO</integer></dict>
  <key>StandardOutPath</key><string>$HOME/.veiculomais/coletor.log</string>
  <key>StandardErrorPath</key><string>$HOME/.veiculomais/coletor.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Agendado: todo dia às $(printf '%02d:%02d' "$HORA" "$MINUTO"). Log em ~/.veiculomais/coletor.log"
echo "Resumo por IA: guarde a chave com 'npm run chave' (fica em ~/.veiculomais/config.json)."
echo "Para rodar agora:   launchctl start br.com.veiculomais.coletor"
echo "Para desinstalar:   bash coletor/desinstalar-mac.sh"

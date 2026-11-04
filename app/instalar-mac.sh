#!/bin/bash
# Instala o Veículo Mais como app no Mac:
#   - servidor sempre ligado em segundo plano (launchd), que também faz a coleta diária
#   - app "Veículo Mais" em ~/Applications, com ícone, para abrir com um clique
# Uso (uma vez, na pasta do projeto):  npm run instalar
set -e

PORTA=3737
ROTULO="br.com.veiculomais.servidor"
PROJETO="$(cd "$(dirname "$0")/.." && pwd)"
DADOS="$HOME/.veiculomais"
AGENTES="$HOME/Library/LaunchAgents"
PLIST="$AGENTES/$ROTULO.plist"
APP="$HOME/Applications/Veículo Mais.app"

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Node não encontrado. Instale com: brew install node"
  exit 1
fi
if ! "$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)'; then
  echo "O Veículo Mais precisa do Node 22.13 ou mais novo. Atualize com: brew upgrade node"
  exit 1
fi
NODE_DIR="$(dirname "$NODE")"

cd "$PROJETO"
echo "1/5 Instalando dependências..."
npm install --no-audit --no-fund --loglevel=error

mkdir -p "$DADOS" "$AGENTES" "$HOME/Applications"

echo "2/5 Removendo o agendamento antigo (a coleta diária agora fica dentro do app)..."
ANTIGO="$AGENTES/br.com.veiculomais.coletor.plist"
if [ -f "$ANTIGO" ]; then
  launchctl unload "$ANTIGO" 2>/dev/null || true
  rm -f "$ANTIGO"
fi

echo "3/5 Ligando o serviço em segundo plano..."
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ROTULO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--no-warnings</string>
    <string>$PROJETO/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJETO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$DADOS/servidor.log</string>
  <key>StandardErrorPath</key><string>$DADOS/servidor.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>$PORTA</string>
    <key>VEICULOMAIS_LAUNCHD</key><string>1</string>
    <key>PATH</key><string>$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo "4/5 Criando o app em Aplicativos..."
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
TMP="$(mktemp -d)"
ICONSET="$TMP/icone.iconset"
mkdir "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$PROJETO/images/icone-1024.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$PROJETO/images/icone-1024.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/icone.icns"
rm -rf "$TMP"

cat > "$APP/Contents/Info.plist" <<INFO
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Veículo Mais</string>
  <key>CFBundleDisplayName</key><string>Veículo Mais</string>
  <key>CFBundleIdentifier</key><string>br.com.veiculomais.app</string>
  <key>CFBundleExecutable</key><string>veiculomais</string>
  <key>CFBundleIconFile</key><string>icone</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
INFO

cat > "$APP/Contents/MacOS/veiculomais" <<LAUNCHER
#!/bin/bash
# Abre o Veículo Mais: garante que o serviço está no ar e abre a janela do app.
URL="http://localhost:$PORTA/dia.html"
pronto() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORTA/api/fontes"; }
if ! pronto; then
  launchctl load -w "$PLIST" 2>/dev/null
  launchctl kickstart -k "gui/\$(id -u)/$ROTULO" 2>/dev/null
  for i in \$(seq 1 30); do pronto && break; sleep 0.5; done
fi
if [ -d "/Applications/Google Chrome.app" ] || [ -d "\$HOME/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="\$URL"
else
  open "\$URL"
fi
LAUNCHER
chmod +x "$APP/Contents/MacOS/veiculomais"

echo "5/5 Abrindo o Veículo Mais..."
for i in $(seq 1 30); do
  curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORTA/api/fontes" && break
  sleep 0.5
done
open "$APP"
open -R "$APP"

echo ""
echo "Pronto! O Veículo Mais está instalado em Aplicativos."
echo "  - Para abrir: clique em 'Veículo Mais' em Aplicativos (ou arraste o ícone para o Dock)."
echo "  - O serviço liga sozinho quando o Mac inicia e faz a coleta diária."
echo "  - Buscas, horário e chave da IA: na tela Configurações do app."
echo "  - Endereço no navegador: http://localhost:$PORTA"
echo "  - Log do serviço: $DADOS/servidor.log"

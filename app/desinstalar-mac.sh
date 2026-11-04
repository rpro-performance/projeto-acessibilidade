#!/bin/bash
# Remove o app e o serviço do Veículo Mais. Os dados em ~/.veiculomais são mantidos.
AGENTES="$HOME/Library/LaunchAgents"
for rotulo in br.com.veiculomais.servidor br.com.veiculomais.coletor; do
  if [ -f "$AGENTES/$rotulo.plist" ]; then
    launchctl unload "$AGENTES/$rotulo.plist" 2>/dev/null || true
    rm -f "$AGENTES/$rotulo.plist"
  fi
done
rm -rf "$HOME/Applications/Veículo Mais.app"
echo "Veículo Mais removido. Seus dados continuam em ~/.veiculomais (apague a pasta se quiser zerar tudo)."

#!/bin/bash
PLIST="$HOME/Library/LaunchAgents/br.com.veiculomais.coletor.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Agendamento removido. O banco em ~/.veiculomais foi mantido."

#!/bin/bash
# DAM - Dobra Kaloria: instalacja / aktualizacja na Macu jednym poleceniem w Terminalu:
#   curl -fsSL https://raw.githubusercontent.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/wydania/instaluj-mac.sh | bash
#
# Co robi:
# 1. zamyka dzialajacy DAM (takze most i serwer w tle - inaczej nowa aplikacja laczy sie ze starym mostem),
# 2. pobiera najnowszy obraz dla tego procesora (Intel albo Apple Silicon) z ostatniego wydania,
# 3. stara aplikacje przenosi do Kosza, nowa kopiuje do /Applications,
# 4. zdejmuje kwarantanne (macOS nie pyta wtedy o "otworz mimo to" i nie trzeba klikac z Control),
# 5. uruchamia DAM.
# Dane programu (konta, ustawienia, aktywacja w peku kluczy) zostaja w ~/Library/Application Support/DAM.
set -euo pipefail

REPO="inyfinn/DAM---Dobra-Kaloria---inyfinn"
case "$(uname -m)" in
  arm64) ARCH="AppleSilicon" ;;
  x86_64) ARCH="Intel" ;;
  *) echo "Nieznany procesor: $(uname -m)"; exit 1 ;;
esac
URL="https://github.com/$REPO/releases/latest/download/DAM-$ARCH.dmg"
TMP="$(mktemp -d /tmp/dam-instalacja.XXXXXX)"
DMG="$TMP/DAM-$ARCH.dmg"
MP="$TMP/obraz"

echo "1/5 Zamykam DAM (okno, most, serwer w tle)..."
osascript -e 'tell application "DAM" to quit' >/dev/null 2>&1 || true
sleep 2
pkill -f "/DAM[^/]*.app/Contents/MacOS/DAM" >/dev/null 2>&1 || true
sleep 1
pkill -9 -f "/DAM[^/]*.app/Contents/MacOS/DAM" >/dev/null 2>&1 || true

echo "2/5 Pobieram DAM-$ARCH.dmg z ostatniego wydania..."
curl -fL --progress-bar -o "$DMG" "$URL"

echo "3/5 Instaluje do /Applications..."
mkdir -p "$MP"
hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MP" >/dev/null
# Wszystkie stare kopie do Kosza ("DAM 2.app" po "Zachowaj obie", kopia w Pobranych / na Biurku): inaczej Dock i Launchpad
# otwieraja stara wersje mimo instalacji nowej.
STAMP="$(date +%Y%m%d-%H%M%S)"; N=0
for OLD in /Applications/DAM*.app "$HOME/Applications"/DAM*.app "$HOME/Downloads"/DAM*.app "$HOME/Desktop"/DAM*.app; do
  [ -d "$OLD" ] || continue
  N=$((N+1)); mv "$OLD" "$HOME/.Trash/DAM-stara-$STAMP-$N.app"
  echo "   stara kopia do Kosza: $OLD"
done
ditto "$MP/DAM.app" "/Applications/DAM.app"
hdiutil detach "$MP" >/dev/null || true

echo "4/5 Dodaje DAM do zaufanych (zdejmuje kwarantanne)..."
xattr -dr com.apple.quarantine "/Applications/DAM.app" 2>/dev/null || true

VER="$(grep -m1 '"version"' /Applications/DAM.app/Contents/Resources/damroot/bin/apps/web/version.json 2>/dev/null | sed -E 's/.*"version": *"([^"]+)".*/\1/' || true)"
echo "5/5 Uruchamiam DAM ${VER:+$VER }..."
open "/Applications/DAM.app"
echo "Gotowe. Obraz instalacyjny zostal w $TMP (macOS sam czysci /tmp po restarcie)."

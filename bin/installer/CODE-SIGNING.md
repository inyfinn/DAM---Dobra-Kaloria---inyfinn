# Podpis instalatora DAM (Windows + Apple)

To **nie** jest podpis sterownika (WHQL / kernel). DAM to zwykła aplikacja użytkownika. Windows krzyczy „aplikacja z nieznanego źródła / nieznany wydawca”, bo `DAM-Setup.exe` i `DAM.exe` **nie mają Authenticode**.

## Windows (SmartScreen / „nieznany wydawca”)

1. Kup **Code Signing** (OV minimum, **EV** szybciej uczy SmartScreen): DigiCert, Sectigo, SSL.com — na firmę Inyfinn (dane z KRS).
2. Zainstaluj **Windows SDK** (SignTool). Ten PC dziś **nie ma** `signtool.exe`.
3. Nie commituj `.pfx`. Ustaw na maszynie build:

```text
DAM_CODE_SIGN_PFX=C:\secrets\inyfinn-codesign.pfx
DAM_CODE_SIGN_PASSWORD=...
```

albo cert w magazynie Windows:

```text
DAM_CODE_SIGN_THUMBPRINT=<odcisk>
```

4. `build-installer.ps1` woła `sign-dam-binaries.ps1` na `DAM.exe` (staging) i `DAM-Setup.exe`.
5. Po pierwszym publicznym podpisie SmartScreen i tak może straszyć **kilka dni / tysięcy pobrań**, aż zbierze reputację. EV skraca ten okres. Sam Publisher w Inno (`Inyfinn`) bez podpisu **nic** nie zmienia.

Sprawdzenie:

```powershell
Get-AuthenticodeSignature -LiteralPath .\DAM-Setup.exe | Format-List Status, SignerCertificate
```

`Status` musi być `Valid`, a Subject certu = Twoja firma, nie GUID z Windows Hello.

## Apple (Gatekeeper / „unidentified developer”)

Repo buduje `GOOS=windows`. **Nie ma** `DAM.app` / notarization.

- Otwarcie `DAM-Setup.exe` na Macu zawsze wpadnie w Gatekeeper (to Windowsowy installer).
- Żeby Mac widział „znane źródło”: osobny build `.app`, **Developer ID Application**, `codesign`, **notarytool**, `stapler`. To nowy produkt, nie łatka ISS.

Jeśli warning jest na **Windowsie** przy pliku z iCloud/Safari: dodatkowo Strefa internetu (`Zone.Identifier`). Podpis Authenticode i tak jest obowiązkowy.

## Czego ten commit robi

- Skrypt podpisu + hak w `build-installer.ps1`.
- Bez certu build **nie pada** (ostrzeżenie). Warning Windows **nie zniknie**, dopóki nie podasz PFX/EV.

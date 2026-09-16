# Podpis instalatora DAM (Windows)

To **nie** jest podpis sterownika (WHQL / kernel). DAM to aplikacja uzytkownika.

SmartScreen „Nieznany wydawca” = `DAM-Setup.exe` bez **zaufanego** Authenticode (cert od CA w lancuchu Windows).

## Co robi kazdy build (1.8.7+)

`build-installer.ps1` **zawsze** podpisuje `DAM.exe` i `DAM-Setup.exe` (`sign-dam-binaries.ps1`):

1. Gdy jest `DAM_CODE_SIGN_PFX` albo `DAM_CODE_SIGN_THUMBPRINT` (cert **OV/EV** z Certum/DigiCert/SSL.com) - uzywa jego. To jedyny sposob, zeby zielona plansza SmartScreen zniknela u osob pobierajacych z GitHuba.
2. Inaczej: cert `CN=Inyfinn, O=Inyfinn` w magazynie CurrentUser (FriendlyName **Inyfinn DAM code signing**). Nie uzywa certu Photo Resizer.
3. Publiczny `.cer` (bez klucza) ląduje w `bin/installer/inyfinn-dam-codesign.cer`. Instalator wpina go do **TrustedPublisher** tego uzytkownika.

Self-signed **nie** uczy SmartScreen. Plik z internetu (strefa MOTW) nadal moze pokazac ostrzezenie, ale we Wlasciwosciach pliku jest wydawca **Inyfinn**, nie pusto.

## Cert CA (zeby zniknelo „Nieznany wydawca” z internetu)

1. Kup **Code Signing** na Inyfinn (OV minimum, **EV** szybciej). Certum / DigiCert / SSL.com. Dane z KRS.
2. Nie commituj `.pfx`. Na maszynie build:

```text
DAM_CODE_SIGN_PFX=C:\secrets\inyfinn-codesign.pfx
DAM_CODE_SIGN_PASSWORD=...
```

albo odcisk z magazynu:

```text
DAM_CODE_SIGN_THUMBPRINT=<odcisk>
```

3. Po pierwszym publicznym podpisie CA SmartScreen i tak bywa przez dni/pobrania (reputacja). EV skraca.

## Sprawdzenie

```powershell
Get-AuthenticodeSignature -LiteralPath .\bin\instalator\DAM-Setup.exe | Format-List Status, SignerCertificate
```

Musi byc `SignerCertificate.Subject` z `Inyfinn`. `Valid` przy self-signed wymaga zaufania lokalnego; przy certcie CA bywa `Valid` od razu.

## Apple

Repo buduje Windows. `DAM-Setup.exe` na Macu wpadnie w Gatekeeper. Osobny `.app` + Developer ID + notarytool.

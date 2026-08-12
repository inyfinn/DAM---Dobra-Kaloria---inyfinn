# Miniaturki wizualizacji (serwowanie statyczne)

Galeria `visualizations.html` laduje miniatury wylacznie z `apps/web/data/thumbs/` (sciezka wzgledna `data/thumbs/*.jpg`), generowanych przez `build-file-index.py` podczas indeksowania. Pelne sciezki dyskowe `D:/Marketing/...` nie sa serwowane przez przegladarke - w UI wyswietlane sa tylko jako tekst do skopiowania. Lokalny serwer statyczny (np. `http://127.0.0.1:8765`) musi mapowac katalog `apps/web` jako document root, aby `data/thumbs/` bylo dostepne bez dodatkowego proxy.

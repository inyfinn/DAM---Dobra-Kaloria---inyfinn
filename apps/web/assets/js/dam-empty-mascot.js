/**
 * Shared empty-state: comic lines + mood → pose (joke / sad / ok / think).
 * window.DamEmptyMascot.pick() → { text, mood, poseFile, poseUrl }
 */
(function () {
  "use strict";

  var POSES = {
    joke: [
      "pose-joy-1.png",
      "pose-joy-2.png",
      "pose-joy-3.png",
      "pose-joy-4.png",
      "pose-joy-5.png",
      "pose-joy-6.png",
      "pose-megaphone.png"
    ],
    sad: ["pose-sad-1.png", "pose-sad-2.png", "pose-sad-3.png", "pose-sad-report.png"],
    ok: ["pose-approve-8.png"],
    think: ["pose-think-q.png", "pose-think-dots.png", "pose-neutral.png"]
  };

  /* mood: joke | sad | ok | think — no em-dash */
  var LINES = [
    { t: "Szukałeś ciasteczek, a znalazłeś nic... Niefajnie.", m: "sad" },
    { t: "Nooo, Giciarsko, miały być pliki, a jestem ja... Bo nic nie znalazłem.", m: "sad" },
    { t: "Niestety, nie mam żadnych takich rzeczy.", m: "sad" },
    { t: "Skryło się to tak, że nawet najstarsi graficy tego nie znajdą.", m: "think" },
    { t: "Przeszukałem pół indeksu. Znalazłem: zero. I trochę smutku.", m: "sad" },
    { t: "Filtr złapał powietrze. Dosłownie.", m: "joke" },
    { t: "Tu miało być pełno wizualizacji. Zostałem sam z dykiem.", m: "sad" },
    { t: "Hmm... albo literówka, albo ten produkt żyje w innej galaktyce.", m: "think" },
    { t: "Pusto jak w folderze przed pierwszym eksportem.", m: "sad" },
    { t: "Szukałem mocno. Wynik: cisza i ja z pytajnikiem.", m: "think" },
    { t: "Nic tu nie ma. Nawet prototyp się schował.", m: "think" },
    { t: "Filtr był zbyt wybredny. Ja też czasem bywam.", m: "joke" },
    { t: "Zero hitów. Ale dymek mam - to już coś!", m: "joke" },
    { t: "Może spróbuj luźniej? Ja lubię, gdy coś w ogóle wraca.", m: "ok" },
    { t: "Szukałeś skarbu. Znalazłeś Dobrokaloriusza. Kompromis.", m: "joke" },
    { t: "Indeks milczy. Ja też mógłbym, ale lubię gadać.", m: "joke" },
    { t: "Brak wyników. Poziom: mistrzowskie schowanie.", m: "think" },
    { t: "Tu pusto. Naprawdę pusto. Sprawdziłem dwa razy.", m: "sad" },
    { t: "Filtr zjadł wszystko. Zostawił mnie na deser.", m: "joke" },
    { t: "Nie ma takiej wizualizacji... jeszcze. Albo już. Kto wie.", m: "think" },
    { t: "Wynik wyszukiwania: ja + znak zapytania. Klasyka.", m: "think" },
    { t: "Przewróciłem tagi do góry nogami. Nic nie wypadło.", m: "joke" },
    { t: "Albo zła nazwa, albo plik poszedł na kawę.", m: "joke" },
    { t: "Pusto. Ale ładnie pusto, przyznaj.", m: "ok" },
    { t: "Szukałem, szukałem... i znalazłem okazję do żartu.", m: "joke" },
    { t: "Zero. Jak budżet na stocki w piątek po 16:00.", m: "joke" },
    { t: "Nic nie pasuje. Nawet ja ledwo pasuję do tego filtra.", m: "sad" },
    { t: "Galerię omieciono. Został dymek i ja.", m: "sad" },
    { t: "Może to w Brandingu? Tu na razie pustka.", m: "think" },
    { t: "Filtr powiedział nie. Ja mówię: spróbuj inaczej.", m: "ok" },
    { t: "Brak plików. Za to jestem ja - bonus pocieszenia.", m: "ok" },
    { t: "Szukasz igły w stogu siana. Siano też uciekło.", m: "joke" },
    { t: "Wynik: 0. Morale: prawie 0. Humor: jeszcze działa.", m: "joke" },
    { t: "Tu nic nie ma. Naprawdę chciałem coś znaleźć!", m: "sad" },
    { t: "Pusto jak mockup bez treści. Klasyczny fail.", m: "sad" },
    { t: "Filtr był ostry jak nóż. Za ostry.", m: "joke" },
    { t: "Nie ma takich. Chyba że w innym języku / marce?", m: "think" },
    { t: "Szukałeś wizualizacji. Znalazłeś zagadkę dnia.", m: "think" },
    { t: "Cisza w siatce. Ja wypełniam lukę osobowością.", m: "joke" },
    { t: "Nic. Ale jak klikniesz Wyczyść filtry, damy radę od nowa.", m: "ok" },
    /* +30 similar */
    { t: "Schowało się lepiej niż warstwa z literówką w finalu.", m: "think" },
    { t: "Szukałem assetu. Znalazłem echo. I trochę kurzu w indeksie.", m: "sad" },
    { t: "Ten filtr ma wyższe wymagania niż klient po poprawkach.", m: "joke" },
    { t: "Zero plików. Za to mam minę jak po odrzuconym proofie.", m: "sad" },
    { t: "Ukryte tak dobrze, że nawet ścieżka się wyparowała.", m: "think" },
    { t: "Pusto. Sprawdziłem za kanapką. Też nic.", m: "joke" },
    { t: "Wynik: cisza. Jak folder Shared przed uprawnieniami.", m: "sad" },
    { t: "Może literówka? Albo plik poszedł na urlop bez zwrotki.", m: "think" },
    { t: "Filtr zrobił porządek. Za dobry porządek.", m: "joke" },
    { t: "Nic nie pasuje. Nawet podgląd się zawstydził i zniknął.", m: "sad" },
    { t: "Szukałeś mocno. Indeks odpowiedział: hmm.", m: "think" },
    { t: "Tu miało błyszczeć. Błyszczy tylko mój pytajnik.", m: "think" },
    { t: "Brak hitów. Poziom: mistrz kamuflażu brandowego.", m: "joke" },
    { t: "Omietłem tagi. Został kurz i ja.", m: "sad" },
    { t: "Albo zły filtr, albo plik gra w chowanego od 2019.", m: "joke" },
    { t: "Pusto jak brief bez briefu. Klasa.", m: "joke" },
    { t: "Nie ma. Sprawdziłem dwa razy, bo raz brzmiało zbyt dramatycznie.", m: "sad" },
    { t: "Wynik wyszukiwania: atmosfera tajemnicy. Zero plików.", m: "think" },
    { t: "Filtr powiedział nie. Ja mówię: luz, spróbujmy inaczej.", m: "ok" },
    { t: "Szukasz igły. Siano uciekło. Igła też.", m: "joke" },
    { t: "Zero. Jak eksport przed pierwszym save.", m: "sad" },
    { t: "Skryło się głębiej niż warstwa Locked w Illu.", m: "think" },
    { t: "Nic tu nie ma - ale Wyczyść filtry robi cuda. Naprawdę.", m: "ok" },
    { t: "Galeria pusta. Ja pełen komentarzy. Bilans zerowy.", m: "joke" },
    { t: "Przeszukałem pół dysku emocjonalnie. Technicznie: 0.", m: "sad" },
    { t: "Hmm... albo zła fraza, albo to żyje pod inną nazwą.", m: "think" },
    { t: "Filtr zjadł wyniki na śniadanie. Zostawił mnie na lunch.", m: "joke" },
    { t: "Brak materiałów. Za to jestem ja - oficjalny pocieszyciel DAM.", m: "ok" },
    { t: "Pusto jak po masowym rename bez backupu. Prawie.", m: "sad" },
    { t: "Nie ma takich. Chyba że w Archiwum, w Brandingu, w innej rzeczywistości.", m: "think" },
    /* +30 more */
    { t: "Szukałem w tagach, w nazwie, w duszy. Dusza też nic nie wie.", m: "sad" },
    { t: "Ten wynik jest tak pusty, że aż echem odpisał.", m: "joke" },
    { t: "Ukryte jak hasło do FTP zapisane na karteczce... której nie ma.", m: "think" },
    { t: "Zero. Jak inbox po urlopie, tylko odwrotnie i smutniej.", m: "sad" },
    { t: "Filtr był precyzyjny. Za precyzyjny. Jak laser na komara.", m: "joke" },
    { t: "Może spróbuj bez jednego tagu? Ja wierzę w drugą szansę.", m: "ok" },
    { t: "Nic nie znalazłem. Sprawdziłem nawet pod dywanikiem indeksu.", m: "think" },
    { t: "Pusto. A miało być pełno ładnych klatek i mojej dumy.", m: "sad" },
    { t: "Szukałeś pliku. Znalazłeś mnie z pytajnikiem. Upgrade?", m: "joke" },
    { t: "Brak wyników. Oficjalnie zatwierdzam: tu naprawdę nic nie ma.", m: "ok" },
    { t: "Schowało się głębiej niż komentarz TODO w starym CSS.", m: "think" },
    { t: "Wynik: 0 plików, 1 zawiedziony Dobrokaloriuś.", m: "sad" },
    { t: "Albo literówka, albo ten asset zmienił nazwisko.", m: "think" },
    { t: "Filtr zmiótł wszystko. Zostawił tylko dymek i honor.", m: "joke" },
    { t: "Tu cisza. Taka specjalna, indeksowa cisza.", m: "sad" },
    { t: "Nie ma. Ale jak poluzujesz filtr, damy radę - serio.", m: "ok" },
    { t: "Przeszukałem frazy. Fraza przeszukała mnie. Remis: zero.", m: "joke" },
    { t: "Ukryte tak, że nawet miniatura się wypięła i poszła.", m: "think" },
    { t: "Pusto jak po usunięciu warstwy Background. Dramat.", m: "sad" },
    { t: "Zero hitów. Poziom: ninja w folderze Marketing.", m: "joke" },
    { t: "Hmm... spróbuj innej marki albo luźniejszego słowa.", m: "ok" },
    { t: "Nic tu nie pasuje. Nawet mój optymizm lekko siadł.", m: "sad" },
    { t: "Szukałem wizualizacji. Znalazłem zagadkę z dymkiem.", m: "think" },
    { t: "Filtr powiedział NIE wielkimi literami. Ja mówię: okej, reset.", m: "ok" },
    { t: "Brak plików. Za to pełen zestaw min i komentarzy.", m: "joke" },
    { t: "Omietłem galerię. Kurz tak, assetów nie.", m: "sad" },
    { t: "Skryło się jak link w mailu bez uprawnień. Klasyka.", m: "think" },
    { t: "Wynik wyszukiwania: atmosfera biura o 17:01. Pusto.", m: "joke" },
    { t: "Nie ma takich. Naprawdę chciałem - nawet pozę zmieniłem.", m: "sad" },
    { t: "Kliknij Wyczyść filtry. Ja zostaję jako kibic sukcesu.", m: "ok" }
  ];

  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* Cache-bust after alpha-trim of pose PNGs (medal size unchanged). */
  var POSE_ASSET_V = "trimAlpha20260723b";

  function poseUrl(file) {
    var rel =
      "assets/img/maskotka/" +
      String(file || "pose-think-q.png").replace(/^\/+/, "") +
      "?v=" +
      POSE_ASSET_V;
    try {
      return new URL(rel, window.location.href).href;
    } catch (e) {
      return rel;
    }
  }

  function pick() {
    var entry = pickOne(LINES);
    var mood = entry.m;
    if (!POSES[mood]) mood = "think";
    var file = pickOne(POSES[mood]);
    return {
      text: entry.t,
      mood: mood,
      poseFile: file,
      poseUrl: poseUrl(file)
    };
  }

  window.DamEmptyMascot = {
    pick: pick,
    poseUrl: poseUrl,
    lines: LINES,
    poses: POSES
  };
})();

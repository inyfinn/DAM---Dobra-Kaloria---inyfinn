/**
 * Eval "parity": jeden plik JS wstrzykiwany przez Runtime.evaluate (via shot.js)
 * na kazdej stronie DAM (Projekty/Wizualizacje/Branding/Explorer/Karta produktu).
 * Zbiera TYLKO to, co widzi uzytkownik w DOM - liczby, statusy, zaslepki - zeby
 * porownac zlota aplikacje (ROOT) z kopia bez ROOT.
 *
 * Zwraca jeden JSON. Pola, ktorych dana strona nie ma, zostaja null/0 - to normalne,
 * porownanie robi run-parity.ps1 pole po polu.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Poczekaj az strona zdazy wyrenderowac karty/obrazki (rozne strony, rozne selektory).
  for (let i = 0; i < 60; i++) {
    const n = document.querySelectorAll(
      '[class*="project"], [class*="card"], [class*="viz-card"], img'
    ).length;
    if (n > 8) break;
    await sleep(500);
  }

  // Przewin cala strone, zeby lazy-load zdazyl zaladowac obrazki.
  const scrollHeight = () => document.documentElement.scrollHeight;
  let y = 0;
  const maxScroll = Math.min(scrollHeight(), 20000);
  while (y < maxScroll) {
    y += 900;
    window.scrollTo(0, y);
    await sleep(700);
  }
  await sleep(5000);
  window.scrollTo(0, 0);
  await sleep(1000);

  const textOf = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, " ").trim() : null);
  const visible = (el) => !!(el && el.offsetParent);

  // --- Licznik gorny (np. "196 produktow * 520 wariantow" albo "161 / 168 elementow * 434 / 441 plikow") ---
  const counterEl = [...document.querySelectorAll("*")].find((e) => {
    if (e.children.length >= 3) return false;
    const t = e.textContent || "";
    return /\d+\s*(\/\s*\d+)?\s*(produkt|wariant|element|plik)/i.test(t) && t.length < 160;
  });
  const licznik_tekst = textOf(counterEl);

  // --- Karty (produkt/wizualizacja/branding) ---
  const cardSelectors = [
    ".dam-project-card", "[class*='project-card']",
    ".dam-viz-card", "[class*='viz-card']",
    ".dam-catalog-marketing-card", "[class*='marketing-card']",
    "[class*='product-card']",
  ];
  const cardSet = new Set();
  cardSelectors.forEach((sel) => document.querySelectorAll(sel).forEach((e) => cardSet.add(e)));
  const cards = [...cardSet];
  const liczba_kart = cards.length;

  // --- Status "Kompletny" / "Niekompletny" (leaf node z dokladnie tym tekstem) ---
  const statusLeaves = [...document.querySelectorAll("*")].filter(
    (e) => e.children.length === 0 && visible(e) && /^(Kompletny|Niekompletny)$/.test((e.textContent || "").trim())
  );
  const kompletne = statusLeaves.filter((e) => e.textContent.trim() === "Kompletny").length;
  const niekompletne = statusLeaves.filter((e) => e.textContent.trim() === "Niekompletny").length;

  // --- Obrazki: wczytane / zepsute / w trakcie ---
  const imgs = [...document.querySelectorAll("img")];
  const relevantImgs = imgs.filter(
    (i) => /thumb|media|cache/i.test(i.getAttribute("src") || "") || i.closest("[class*='card']")
  );
  const useImgs = relevantImgs.length ? relevantImgs : imgs;
  const wczytane = useImgs.filter((i) => i.complete && i.naturalWidth > 0).length;
  const zepsute = useImgs.filter((i) => i.complete && i.naturalWidth === 0).length;
  const w_trakcie = useImgs.length - wczytane - zepsute;

  // --- Zaslepki (brak podgladu/miniatury) ---
  const zaslepki = [...document.querySelectorAll("*")].filter(
    (e) =>
      e.children.length === 0 &&
      visible(e) &&
      /Podgl[ąa]d niedost[ęe]pny|Brak podgl[ąa]du|Brak miniatury/i.test(e.textContent || "")
  ).length;

  // --- project.html: status projektu, checklist kompletnosci, materialy marketingowe, KPI bento ---
  const isProjectPage = /project\.html/i.test(location.pathname) || /project\.html/i.test(location.href);
  let projekt = null;
  if (isProjectPage) {
    const statusEl = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && /^Status\s*:/i.test((e.textContent || "").trim())
    );
    const status_tekst = textOf(statusEl);

    // Checklisty kompletnosci: element z checkboxem/ikona + etykieta obok, kolor zielony/czerwony.
    const checklistCandidates = [...document.querySelectorAll(
      "[class*='checklist'] li, [class*='complet'] li, [class*='check'] [class*='item'], [class*='requirement']"
    )];
    const checklist = checklistCandidates.slice(0, 60).map((e) => {
      const cs = getComputedStyle(e);
      const colorSrc = e.querySelector("[class*='icon'], [class*='dot'], [class*='check']") || e;
      const color = getComputedStyle(colorSrc).color;
      const isGreen = /rgb\(\s*(\d+)/.exec(color) && (() => {
        const m = color.match(/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
        if (!m) return null;
        const [, r, g, b] = m.map(Number);
        return g > r + 20 && g > b + 20;
      })();
      const isRed = (() => {
        const m = color.match(/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
        if (!m) return null;
        const [, r, g, b] = m.map(Number);
        return r > g + 20 && r > b + 20;
      })();
      return {
        nazwa: textOf(e) ? textOf(e).slice(0, 80) : null,
        kolor: isGreen ? "zielony" : isRed ? "czerwony" : color,
      };
    }).filter((x) => x.nazwa);

    const marketingCards = document.querySelectorAll(
      ".dam-catalog-marketing-card, [class*='marketing-card'], [class*='marketing-material']"
    );
    const liczba_materialow_marketingowych = marketingCards.length;

    const kpiBento = document.querySelector(".dam-catalog-kpi-bento, [class*='kpi-bento']");
    const ma_kpi_bento = !!kpiBento;

    projekt = {
      status_tekst,
      checklist_kompletnosci: checklist,
      liczba_materialow_marketingowych,
      ma_kpi_bento,
    };
  }

  return {
    url: location.href,
    tytul_strony: document.title,
    licznik_tekst,
    liczba_kart,
    kompletne,
    niekompletne,
    obrazki_razem: useImgs.length,
    obrazki_wczytane: wczytane,
    obrazki_zepsute: zepsute,
    obrazki_w_trakcie: w_trakcie,
    zaslepki_widoczne: zaslepki,
    projekt,
    blokowane_nawigacje: window.__damBlockedNav || [],
  };
})()

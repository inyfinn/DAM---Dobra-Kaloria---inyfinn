/**
 * Plakietki (marka/kategoria/...) W OKNIE PODGLADU (#damMediaPreview / #damVizModal)
 * musza dzialac zgodnie z wlasnym dymkiem: Klik = filtr, Ctrl+klik = dodaj do
 * wyszukiwania, Shift+klik = edytuj. Run: node apps/web/scripts/tests/test_badge_modal_actions.js
 *
 * Kontekst (2026-09-23, zgloszenie uzytkownika): dawniej dam-badges.js mial twardy
 * blok "HARD: tags in preview/viz modal must NOT drive page search/filters behind
 * the modal" - Klik i Ctrl+klik w oknie byly calkowicie martwe, mimo ze dymek
 * obiecywal dzialanie. Decyzja produktowa: NAJPIERW zamknij okno (jego wlasnym
 * przyciskiem zamkniecia), POTEM zastosuj filtr na odslonietej stronie - dzieki
 * temu strona pod oknem nie zmienia sie w trakcie ogladania (powod oryginalnego
 * zakazu), a klik robi to, co obiecuje. Shift+klik ma pozostac bez zmian: otwiera
 * edycje NAD oknem (okno NIE jest zamykane, popover ma wyzszy z-index).
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-badges.js");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function eq(got, want, label) {
  var a = JSON.stringify(got);
  var b = JSON.stringify(want);
  if (a !== b) {
    console.error("FAIL " + label + ":\n  oczekiwano " + b + "\n  jest       " + a);
    fails++;
  }
}

/* ---------- Minimalny DOM (bez jsdom - brak w repo, wzor test_saved_logins_ui.js) ---------- */

function parseSel(sel) {
  var re = /(^[a-zA-Z][a-zA-Z0-9]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  var tag = null, id = null, classes = [], attrs = [], m;
  while ((m = re.exec(sel))) {
    if (m[1]) tag = m[1].toUpperCase();
    else if (m[2]) id = m[2];
    else if (m[3]) classes.push(m[3]);
    else if (m[4]) attrs.push({ name: m[4], value: m[5] });
  }
  return { tag: tag, id: id, classes: classes, attrs: attrs };
}

function elMatches(el, parsed) {
  if (parsed.tag && el.tagName !== parsed.tag) return false;
  if (parsed.id && el.id !== parsed.id) return false;
  for (var i = 0; i < parsed.classes.length; i++) {
    if (!el.classList.contains(parsed.classes[i])) return false;
  }
  for (var j = 0; j < parsed.attrs.length; j++) {
    var a = parsed.attrs[j];
    var v = el.getAttribute(a.name);
    if (v === null) return false;
    if (a.value !== undefined && v !== a.value) return false;
  }
  return true;
}

function makeEl(tag) {
  var classes = [];
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    id: "",
    _attrs: {},
    parentNode: null,
    children: [],
    value: "",
    textContent: "",
    _listeners: {},
    classList: {
      contains: function (c) { return classes.indexOf(c) !== -1; },
      add: function (c) { if (classes.indexOf(c) === -1) classes.push(c); },
      remove: function (c) { var i = classes.indexOf(c); if (i !== -1) classes.splice(i, 1); },
      toggle: function (c, on) {
        if (on === undefined) on = classes.indexOf(c) === -1;
        if (on) this.add(c); else this.remove(c);
      },
    },
    setAttribute: function (k, v) { this._attrs[k] = String(v); if (k === "id") this.id = String(v); },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
    },
    removeAttribute: function (k) { delete this._attrs[k]; },
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; },
    remove: function () {
      if (this.parentNode) {
        var idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
      }
      this.parentNode = null;
    },
    addEventListener: function (type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    dispatchEvent: function (evt) {
      (this._listeners[evt.type] || []).forEach(function (fn) { fn(evt); });
      return true;
    },
    click: function () {
      this.dispatchEvent({ type: "click", preventDefault: function () {}, stopPropagation: function () {} });
    },
    focus: function () {},
    closest: function (sel) {
      var parsed = parseSel(sel);
      var cur = this;
      while (cur) {
        if (elMatches(cur, parsed)) return cur;
        cur = cur.parentNode;
      }
      return null;
    },
    contains: function (other) {
      var cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    },
  };
  Object.defineProperty(el, "className", {
    get: function () { return classes.join(" "); },
    set: function (v) { classes = String(v || "").split(/\s+/).filter(Boolean); },
  });
  return el;
}

var docRegistry = {};
function registerId(el) { if (el && el.id) docRegistry[el.id] = el; }

var fakeDocument = makeEl("document");
fakeDocument.readyState = "complete";
fakeDocument.getElementById = function (id) {
  return Object.prototype.hasOwnProperty.call(docRegistry, id) ? docRegistry[id] : null;
};
fakeDocument.createElement = function (tag) { return makeEl(tag); };
fakeDocument.head = makeEl("head");
fakeDocument.documentElement = makeEl("html");
fakeDocument.body = makeEl("body");
fakeDocument.querySelector = function () { return null; };

var sandbox = {
  console: console,
  window: {},
  setTimeout: function (fn) { fn(); }, // makrotask w tescie: wykonaj od razu (deterministycznie)
  clearTimeout: function () {},
  Event: function (type, opts) {
    this.type = type;
    if (opts) for (var k in opts) this[k] = opts[k];
  },
  CustomEvent: function (type, opts) {
    this.type = type;
    if (opts) for (var k in opts) this[k] = opts[k];
  },
  navigator: {},
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  document: fakeDocument,
};
sandbox.window.window = sandbox.window;
sandbox.window.document = fakeDocument; // "global.document..." (global = window w IIFE)
sandbox.window.location = { pathname: "/branding.html" };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, "utf8"), sandbox);

var DamBadges = sandbox.window.DamBadges;
ok(!!DamBadges, "DamBadges zaladowany");
ok(typeof DamBadges.closeHostPreviewModal === "function", "closeHostPreviewModal wyeksportowany");

/* ---------- 1) closeHostPreviewModal - jednostkowo ---------- */

(function testCloseHostPreviewModal() {
  docRegistry = {};

  var mediaPreview = makeEl("div"); mediaPreview.setAttribute("id", "damMediaPreview"); registerId(mediaPreview);
  var mediaCloseBtn = makeEl("button"); mediaCloseBtn.setAttribute("id", "damMediaPreviewClose"); registerId(mediaCloseBtn);
  mediaCloseBtn._clicked = 0;
  mediaCloseBtn.addEventListener("click", function () { mediaCloseBtn._clicked++; });

  var badgeInMedia = makeEl("button");
  badgeInMedia.parentNode = mediaPreview; // uproszczony lancuch (closest nie wymaga pelnej glebokosci)

  ok(DamBadges.closeHostPreviewModal(badgeInMedia) === true, "closeHostPreviewModal: #damMediaPreview -> true");
  eq(mediaCloseBtn._clicked, 1, "closeHostPreviewModal: kliknieto #damMediaPreviewClose dokladnie raz");

  var vizModal = makeEl("div"); vizModal.setAttribute("id", "damVizModal"); registerId(vizModal);
  var vizCloseBtn = makeEl("button"); vizCloseBtn.setAttribute("id", "damVizModalClose"); registerId(vizCloseBtn);
  vizCloseBtn._clicked = 0;
  vizCloseBtn.addEventListener("click", function () { vizCloseBtn._clicked++; });

  var badgeInViz = makeEl("button");
  badgeInViz.parentNode = vizModal;

  ok(DamBadges.closeHostPreviewModal(badgeInViz) === true, "closeHostPreviewModal: #damVizModal -> true");
  eq(vizCloseBtn._clicked, 1, "closeHostPreviewModal: kliknieto #damVizModalClose dokladnie raz");
  eq(mediaCloseBtn._clicked, 1, "closeHostPreviewModal: #damMediaPreviewClose NIE ruszony przy #damVizModal");

  var badgeOutside = makeEl("button");
  var card = makeEl("div"); // brak #damMediaPreview / #damVizModal w lancuchu
  badgeOutside.parentNode = card;
  ok(DamBadges.closeHostPreviewModal(badgeOutside) === false, "closeHostPreviewModal: poza oknem -> false, bez skutkow");
  eq(mediaCloseBtn._clicked, 1, "closeHostPreviewModal: poza oknem nie dotyka zadnego przycisku zamkniecia (media)");
  eq(vizCloseBtn._clicked, 1, "closeHostPreviewModal: poza oknem nie dotyka zadnego przycisku zamkniecia (viz)");
})();

/* ---------- 2) Pelny przeplyw klikniecia przez bindClicks ---------- */

function setupScenario(opts) {
  opts = opts || {};
  docRegistry = {};
  sandbox.window.DamTagEdit = opts.tagEdit || null;
  sandbox.window.DamBranding = null;

  var modal = null, closeBtn = null;
  if (opts.modalId) {
    modal = makeEl("div"); modal.setAttribute("id", opts.modalId); registerId(modal);
    closeBtn = makeEl("button"); closeBtn.setAttribute("id", opts.closeBtnId); registerId(closeBtn);
    closeBtn._clicked = 0;
    closeBtn.addEventListener("click", function () { closeBtn._clicked++; });
  }

  var root = makeEl("div");
  if (modal) root.parentNode = modal;

  var badge = makeEl("button");
  badge.setAttribute("data-tag-kind", "brand");
  badge.setAttribute("data-tag-value", "DK");
  badge.textContent = "DK";
  badge.classList.add("dam-badge-tag");
  badge.classList.add("dam-viz-badge--brand");
  badge.classList.add("dam-tag-editable");
  badge.parentNode = root;

  var searchInput = makeEl("input");
  searchInput.setAttribute("id", "damBrandingSearch");
  registerId(searchInput);

  DamBadges.bindClicks(root, "branding");

  return { root: root, badge: badge, closeBtn: closeBtn, searchInput: searchInput };
}

function fireClick(root, badge, modifiers) {
  var evt = {
    type: "click",
    target: badge,
    shiftKey: !!(modifiers && modifiers.shift),
    ctrlKey: !!(modifiers && modifiers.ctrl),
    metaKey: !!(modifiers && modifiers.meta),
    altKey: !!(modifiers && modifiers.alt),
    preventDefault: function () {},
    stopPropagation: function () {},
  };
  root.dispatchEvent(evt);
}

/* a) Klik w #damMediaPreview -> zamkniecie okna + applyTagFilter (wpis w wyszukiwarke) */
(function testClickInMediaPreview() {
  var s = setupScenario({ modalId: "damMediaPreview", closeBtnId: "damMediaPreviewClose" });
  fireClick(s.root, s.badge, {});
  eq(s.closeBtn._clicked, 1, "Klik w #damMediaPreview: okno zamkniete (przycisk kliknięty)");
  eq(s.searchInput.value, "DK", "Klik w #damMediaPreview: applyTagFilter wpisal token do wyszukiwarki");
})();

/* b) Ctrl+klik w #damMediaPreview -> append:true (dolaczenie do istniejacej frazy) + zamkniecie */
(function testCtrlClickAppends() {
  var s = setupScenario({ modalId: "damMediaPreview", closeBtnId: "damMediaPreviewClose" });
  s.searchInput.value = "istniejace";
  fireClick(s.root, s.badge, { ctrl: true });
  eq(s.closeBtn._clicked, 1, "Ctrl+klik w #damMediaPreview: okno tez zamkniete");
  eq(s.searchInput.value, "istniejace DK", "Ctrl+klik: token dolaczony (append), stara fraza zachowana");
})();

/* c) Shift+klik w #damVizModal -> otwiera edycje (openTagPicker), okno NIE jest zamykane */
(function testShiftClickOpensEdit() {
  var openCalls = [];
  var tagEdit = {
    isPrivileged: function () { return true; },
    adminModeOn: function () { return false; },
    closePopover: function () {},
    openTagPicker: function (btn, opts) { openCalls.push(opts); },
  };
  var s = setupScenario({ modalId: "damVizModal", closeBtnId: "damVizModalClose", tagEdit: tagEdit });
  fireClick(s.root, s.badge, { shift: true });
  eq(openCalls.length, 1, "Shift+klik: openTagPicker wywolany dokladnie raz");
  ok(openCalls[0] && openCalls[0].kind === "brand" && openCalls[0].value === "DK",
    "Shift+klik: openTagPicker dostal poprawny kind/value plakietki");
  eq(s.closeBtn._clicked, 0, "Shift+klik: okno podgladu NIE jest zamykane (edycja ma byc NAD oknem)");
  eq(s.searchInput.value, "", "Shift+klik: filtr strony nie jest stosowany");
})();

/* d) Poza oknem (karta na liście): zachowanie klasyczne, bez zmian - nic nie zamykamy */
(function testOutsideModalUnchanged() {
  var s = setupScenario({}); // brak modalId -> badge nie jest w zadnym oknie
  fireClick(s.root, s.badge, {});
  eq(s.searchInput.value, "DK", "Poza oknem: klik nadal dziala jak wczesniej (filtr wpisany)");
  ok(DamBadges.closeHostPreviewModal(s.badge) === false,
    "Poza oknem: closeHostPreviewModal nie ma czego zamykac (false)");
})();

if (fails) {
  console.error("\nBLEDOW: " + fails);
  process.exit(1);
}
console.log("OK test_badge_modal_actions (14 asercji)");

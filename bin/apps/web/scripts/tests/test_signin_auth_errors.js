/**
 * 06.10.2026, ekran logowania (signin.html + dam-api.js):
 *  - kazdy kod bledu mostu /auth/login ma WLASNY komunikat (nic nie wpada do "zle haslo"),
 *  - "brak konta" i "zle haslo" to jeden kod (invalid_credentials) - nie zdradzamy istnienia kont,
 *  - stan bazy (online / offline / lokalny / nieaktywowana / most nie dziala) liczy dbStateFrom,
 *  - signin.html: ZADNEGO "Utworz konto admina", jest wiersz stanu bazy i przyciski akcji.
 * Run: node bin/apps/web/scripts/tests/test_signin_auth_errors.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var WEB = path.join(__dirname, "..", "..");
var JS = path.join(WEB, "assets", "js");

var fails = 0;
function ok(cond, label) {
  if (!cond) { console.error("FAIL " + label); fails++; } else { console.log("ok   " + label); }
}
function jsonResponse(data) {
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
}
function makeStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
}

function loadDamApi(routes, calls) {
  var ctx = {
    console: console, Promise: Promise, JSON: JSON, Date: Date, Object: Object, Math: Math,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    localStorage: makeStorage(),
    fetch: function (url, init) {
      if (calls) calls.push({ url: url, init: init || {} });
      var key = Object.keys(routes).filter(function (k) { return url.slice(-k.length) === k; })[0];
      if (key === undefined) {
        if (/\/auth\/identity$/.test(url)) return jsonResponse({ ok: true, machine_id: "dam-mid-t", device_id: "dam-dev-t" });
        return Promise.reject(new Error("nieoczekiwany fetch " + url));
      }
      var r = routes[key];
      return typeof r === "function" ? r(url, init) : jsonResponse(r);
    },
    DamActivation: { show: function () {} },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, "dam-api.js"), "utf8"), ctx, { filename: "dam-api.js" });
  return ctx.DamApi;
}

async function loginErr(payload) {
  var api = loadDamApi({ "/auth/login": payload });
  try { await api.login("a@kubara.pl", "haslo-testowe-123"); return null; } catch (e) { return e; }
}

(async function () {
  /* ---------- A4: mapa kodow -> komunikaty ---------- */
  var cases = [
    ["invalid_credentials", { error: "invalid_credentials", db_source: "postgres" }],
    ["too_many_attempts", { error: "too_many_attempts", retry_after_s: 240 }],
    ["password_change_required", { error: "password_change_required", can_skip: true }],
    ["db_offline", { error: "db_offline", message: "Baza chwilowo niedostępna, spróbuj za chwilę." }],
    ["not_activated", { error: "not_activated", activation_available: true }],
    ["machine_id_required", { error: "machine_id_required" }],
    ["login_failed", { error: "login_failed" }],
    ["ip_blocked", { error: "ip_blocked" }],
    ["saved_login_unreadable", { error: "saved_login_unreadable" }],
  ];
  var seen = {};
  for (var i = 0; i < cases.length; i++) {
    var code = cases[i][0];
    var e = await loginErr(cases[i][1]);
    ok(e && e.code === code, code + ": blad ma kod " + code);
    ok(e && typeof e.message === "string" && e.message.length > 10 && !/^[a-z_]+$/.test(e.message),
      code + ": czytelny komunikat po polsku, nie surowy kod");
    ok(e && !seen[e.message], code + ": komunikat unikalny");
    if (e) seen[e.message] = true;
    if (code !== "invalid_credentials") {
      ok(e && !/Nieprawid/.test(e.message), code + ": NIE wyglada jak 'zle haslo'");
    }
  }
  var unk = await loginErr({ error: "cos_nowego" });
  ok(unk && /cos_nowego/.test(unk.message) && /kod/.test(unk.message), "nieznany kod: komunikat z kodem, nie 'zle haslo'");

  var tma = await loginErr({ error: "too_many_attempts", retry_after_s: 241 });
  ok(tma && /5 min/.test(tma.message) && tma.retryAfter === 241, "too_many_attempts: minuty z retry_after_s (241 s -> 5 min)");
  var tma2 = await loginErr({ error: "too_many_attempts", retry_after_s: 40 });
  ok(tma2 && /1 min/.test(tma2.message), "too_many_attempts: minimum 1 min");

  var inv = await loginErr({ error: "invalid_credentials", db_source: "postgres" });
  ok(inv && inv.message === "Nieprawidłowy email lub hasło.", "invalid_credentials z centralnej bazy: bez doklejek");
  var invLocal = await loginErr({ error: "invalid_credentials", db_source: "local" });
  ok(invLocal && /lokalnej kopii kont/.test(invLocal.message) && invLocal.dbSource === "local",
    "invalid_credentials z lokalnej bazy: ostrzezenie o lokalnej kopii kont");
  var api0 = loadDamApi({});
  ok(/nieaktualne/.test(api0.authMessage("invalid_credentials", {}, { saved: true })),
    "zapisane konto: 'zapisane haslo nieaktualne', nie ogolne 'zle haslo'");

  /* Most nie odpowiada (fetch rzuca) -> osobny blad, nie 'zle haslo' */
  var apiDown = loadDamApi({ "/auth/login": function () { return Promise.reject(new TypeError("Failed to fetch")); } });
  var down = null;
  try { await apiDown.login("a@kubara.pl", "x-haslo-123"); } catch (e2) { down = e2; }
  ok(down && /Most DAM niedostępny/.test(down.message) && !/Nieprawid/.test(down.message), "most nie odpowiada: 'Most DAM niedostepny'");

  /* ---------- rejestracja ---------- */
  var regCases = {
    email_taken: /już istnieje/, password_too_short: /10 znaków/, password_too_weak: /oczywiste/,
    invalid_email: /poprawny email/, db_offline: /Baza chwilowo niedostępna/, db_not_central: /centralną bazą/,
    not_activated: /nie jest aktywowana/,
  };
  for (var rc in regCases) {
    var apiR = loadDamApi({ "/auth/register": { ok: false, error: rc } });
    var re = null;
    try { await apiR.register("n@kubara.pl", "Mocne-Haslo-2026", "N", { selfRegister: true }); } catch (e3) { re = e3; }
    ok(re && re.code === rc && regCases[rc].test(re.message), "register: " + rc + " ma wlasny komunikat");
  }
  var calls = [];
  var apiOk = loadDamApi({
    "/auth/register": { ok: true, user: { email: "n@kubara.pl" } },
    "/auth/login": { ok: true, token: "tok", device_id: "d", machine_id: "m", session_id: "s", user: { email: "n@kubara.pl", role: "user", name: "N" } },
  }, calls);
  apiOk.__ls = null;
  // stary token innego konta w localStorage nie moze zamienic samodzielnej rejestracji w "konto admina"
  var regRes = await apiOk.register("n@kubara.pl", "Mocne-Haslo-2026", "N", { selfRegister: true });
  var regCall = calls.filter(function (c) { return /\/auth\/register$/.test(c.url); })[0];
  ok(regCall && !(regCall.init.headers || {}).Authorization, "selfRegister: bez naglowka Authorization");
  ok(calls.some(function (c) { return /\/auth\/login$/.test(c.url); }) && regRes && regRes.token === "tok",
    "selfRegister: po sukcesie od razu logowanie");

  /* ---------- A3: stan bazy ---------- */
  var f = api0.dbStateFrom;
  ok(f(null, null).state === "bridge_down", "dbState: brak statusu = most nie dziala");
  ok(f({ activation_required: true, engine: "postgres" }, null).state === "not_activated", "dbState: nieaktywowana");
  ok(f({ engine: "postgres", offline_mode: false }, { ok: true, engine: "postgres", offline_mode: false }).state === "online", "dbState: Postgres = online");
  ok(f({ engine: "postgres" }, { ok: true, engine: "sqlite-offline", offline_mode: true, writes_paused: true }).state === "offline",
    "dbState: swiezy ping (offline) wygrywa z cache /db/status (online)");
  ok(f({ engine: "sqlite-offline", offline_mode: true }, null).state === "offline", "dbState: sqlite-offline = offline");
  ok(f({ engine: "sqlite", offline_mode: false }, { ok: true, engine: "sqlite" }).state === "local", "dbState: czysty SQLite = tryb lokalny");
  ok(f({ engine: "postgres" }, { ok: true, engine: "sqlite", error: "health_pending", writes_paused: true }).state === "checking",
    "dbState: health_pending = sprawdzanie, nie 'brak polaczenia'");
  var apiDb = loadDamApi({
    "/db/status": { ok: true, engine: "postgres", activation_required: false },
    "/db/ping": { ok: true, engine: "postgres", offline_mode: false },
  });
  var st = await apiDb.dbState();
  ok(st.state === "online", "dbState(): /db/status + /db/ping -> online");
  var apiDb2 = loadDamApi({ "/db/status": function () { return Promise.reject(new TypeError("Failed to fetch")); } });
  ok((await apiDb2.dbState()).state === "bridge_down", "dbState(): fetch pada -> most nie dziala");

  /* ---------- signin.html: statyczne ---------- */
  var html = fs.readFileSync(path.join(WEB, "signin.html"), "utf8");
  ok(!/Utwórz konto admina/i.test(html) && !/Pierwsze uruchomienie/i.test(html), "signin: brak 'Utworz konto admina' / 'Pierwsze uruchomienie'");
  ok(/id="damDbStatus"/.test(html) && /id="damDbStatusText"/.test(html), "signin: jest wiersz stanu bazy");
  ok(/id="damDbRetry"/.test(html) && /id="damDbActivate"/.test(html), "signin: sa przyciski 'Sprawdz ponownie' i 'Wpisz kod'");
  ok(/Baza: połączono/.test(html) && /Baza: brak połączenia/.test(html), "signin: teksty 'Baza: polaczono' / 'brak polaczenia'");
  ok(/DamApi\.register\(email, password, name, \{ selfRegister: true \}\)/.test(html), "signin: samodzielna rejestracja (selfRegister)");
  ok(!/var registrationOpen = false;[\s\S]{0,200}applyRegistrationPolicy\(false\)/.test(html), "signin: rejestracja nie jest na sztywno wylaczona");
  ok(/DamApi\.dbState\(\)/.test(html) && /checkDb\(\)\.then\(function \(st\)/.test(html), "signin: baza sprawdzana PRZED wyslaniem hasla");
  ok(/submitBtn\.disabled = busy \|\| !canSubmit\(\)/.test(html), "signin: przycisk Zaloguj zablokowany, gdy baza nie odpowiada");
  ok(!/—/.test(html), "signin: bez pauzy (em dash) w tresci");
  /* wersja z version.json, nie wpisana na sztywno - test nie moze padac przy kazdym podbiciu (2.5.5) */
  var APP_VER = JSON.parse(fs.readFileSync(path.join(WEB, "version.json"), "utf8")).version;
  ok(html.indexOf("dam-api.js?v=" + APP_VER) >= 0, "signin: dam-api.js?v=" + APP_VER);
  ok(!/—/.test(fs.readFileSync(path.join(JS, "dam-api.js"), "utf8").split("var AUTH_MESSAGES")[1].split("function dbStateFrom")[0]),
    "dam-api: komunikaty bez pauzy (em dash)");

  /* wszystkie strony (poza *_Conflict*) wskazuja ten sam dam-api.js?v= */
  var vers = {};
  fs.readdirSync(WEB).filter(function (n) { return /\.html$/.test(n) && !/_Conflict/.test(n); }).forEach(function (n) {
    var m = /dam-api\.js\?v=([0-9.]+)/.exec(fs.readFileSync(path.join(WEB, n), "utf8"));
    if (m) vers[m[1]] = (vers[m[1]] || 0) + 1;
  });
  ok(Object.keys(vers).length === 1 && vers[APP_VER] > 0, "dam-api.js?v= spojne w HTML: " + JSON.stringify(vers));

  console.log(fails ? ("\n" + fails + " FAILED") : "\nALL OK");
  process.exit(fails ? 1 : 0);
})();

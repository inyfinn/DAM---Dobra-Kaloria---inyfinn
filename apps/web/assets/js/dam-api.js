(function () {
  "use strict";
  var API = window.DAM_API_BASE || "http://127.0.0.1:8000/api";

  function token() {
    return localStorage.getItem("dam_token") || "";
  }

  function authHeaders() {
    return {
      Authorization: "Bearer " + token(),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  async function parse(r) {
    var data = null;
    try {
      data = await r.json();
    } catch (e) {
      data = null;
    }
    if (r.status === 401) {
      localStorage.removeItem("dam_token");
      location.href = "signin.html";
      throw new Error("Unauthenticated");
    }
    if (!r.ok) {
      throw new Error((data && data.message) || "HTTP " + r.status);
    }
    return data;
  }

  window.DamApi = {
    base: API,
    token: token,
    role: function () {
      return localStorage.getItem("dam_role") || "";
    },
    requireAuth: function () {
      if (!token()) {
        location.href = "signin.html";
        return false;
      }
      return true;
    },
    async health() {
      return parse(await fetch(API + "/health"));
    },
    async login(email, password) {
      var r = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });
      var data = await parse(r);
      localStorage.setItem("dam_token", data.token);
      localStorage.setItem("dam_role", data.user.role);
      localStorage.setItem("dam_user_name", data.user.name || "");
      return data;
    },
    logout: async function () {
      try {
        if (token()) {
          await fetch(API + "/auth/logout", { method: "POST", headers: authHeaders() });
        }
      } catch (e) { /* ignore */ }
      localStorage.removeItem("dam_token");
      localStorage.removeItem("dam_role");
      location.href = "signin.html";
    },
    async me() {
      return parse(await fetch(API + "/auth/me", { headers: authHeaders() }));
    },
    async projects() {
      return parse(await fetch(API + "/projects", { headers: authHeaders() }));
    },
    async project(id) {
      return parse(await fetch(API + "/projects/" + id, { headers: authHeaders() }));
    },
    async completeness(variantId) {
      return parse(await fetch(API + "/variants/" + variantId + "/completeness", { headers: authHeaders() }));
    },
    async recompute(variantId) {
      return parse(await fetch(API + "/variants/" + variantId + "/completeness/recompute", {
        method: "POST",
        headers: authHeaders(),
      }));
    },
    async ingestPointers(index) {
      return parse(await fetch(API + "/ingest/pointers", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ index: index || null }),
      }));
    },
    async notifyIntegrations(variantId) {
      return parse(await fetch(API + "/variants/" + variantId + "/integrations/notify", {
        method: "POST",
        headers: authHeaders(),
      }));
    },
    async authSettings() {
      return parse(await fetch(API + "/auth/settings", { headers: authHeaders() }));
    },
  };
})();

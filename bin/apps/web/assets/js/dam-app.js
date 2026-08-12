(function () {
  "use strict";

  var sidebar = document.getElementById("damSidebar");
  var toggle = document.getElementById("damSidebarToggle");
  var closeBtn = document.getElementById("damSidebarClose");
  var backdrop = document.getElementById("damSidebarBackdrop");

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-visible");
    document.body.classList.add("dam-sidebar-open");
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-visible");
    document.body.classList.remove("dam-sidebar-open");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (sidebar && sidebar.classList.contains("is-open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
  if (backdrop) backdrop.addEventListener("click", closeSidebar);

  document.querySelectorAll("[data-dam-role]").forEach(function (el) {
    var role = el.getAttribute("data-dam-role") || "user";
    el.textContent = role;
  });
})();

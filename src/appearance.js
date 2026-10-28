/* Apply before the page paints. Appearance never reads or changes answers. */
(() => {
  const key = "personal-ai-atlas:appearance";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {}
  function apply() {
    const theme = preference || (media.matches ? "dark" : "light");
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#14171c" : "#f4f7fb";
    const button = document.getElementById("theme-toggle");
    if (button) {
      const next = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", "Use " + next + " appearance");
      button.title = "Use " + next + " appearance";
      document.getElementById("theme-label").textContent =
        next === "dark" ? "Dark mode" : "Light mode";
    }
  }
  apply();
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.getElementById("theme-toggle").addEventListener("click", () => {
      preference = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(key, preference);
      } catch {}
      apply();
    });
  });
  media.addEventListener("change", () => {
    if (!preference) apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      preference =
        event.newValue === "light" || event.newValue === "dark"
          ? event.newValue
          : null;
      apply();
    }
  });
})();

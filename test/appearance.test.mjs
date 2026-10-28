import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const script = fs.readFileSync(
  new URL("../src/appearance.js", import.meta.url),
  "utf8",
);
function start({ saved = null, dark = false, broken = false } = {}) {
  const events = {},
    mediaEvents = {},
    domEvents = {},
    buttonEvents = {},
    writes = [];
  const root = { dataset: {} },
    meta = {},
    label = {},
    button = {
      setAttribute(k, v) {
        this[k] = v;
      },
      addEventListener(k, v) {
        buttonEvents[k] = v;
      },
    };
  const media = {
    matches: dark,
    addEventListener(k, v) {
      mediaEvents[k] = v;
    },
  };
  const ctx = vm.createContext({
    document: {
      documentElement: root,
      querySelector: () => meta,
      getElementById: (id) => (id === "theme-label" ? label : button),
      addEventListener(k, v) {
        domEvents[k] = v;
      },
    },
    window: {
      matchMedia: () => media,
      addEventListener(k, v) {
        events[k] = v;
      },
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, "personal-ai-atlas:appearance");
        if (broken) throw Error("blocked");
        return saved;
      },
      setItem(k, v) {
        if (broken) throw Error("blocked");
        writes.push([k, v]);
      },
    },
  });
  vm.runInContext(script, ctx);
  return {
    root,
    meta,
    label,
    button,
    writes,
    ready: () => domEvents.DOMContentLoaded(),
    click: () => buttonEvents.click(),
    system(value) {
      media.matches = value;
      mediaEvents.change();
    },
    storage(value) {
      events.storage({ key: "personal-ai-atlas:appearance", newValue: value });
    },
  };
}
test("Appearance applies system choice before DOM ready and follows later changes", () => {
  const a = start({ dark: true });
  assert.equal(a.root.dataset.theme, "dark");
  a.system(false);
  assert.equal(a.root.dataset.theme, "light");
  a.ready();
  assert.equal(a.button["aria-label"], "Use dark appearance");
  assert.deepEqual(a.writes, []);
});
test("Explicit appearance survives reload, ignores system changes and never writes answers", () => {
  const a = start({ saved: "dark" });
  a.ready();
  a.system(false);
  assert.equal(a.root.dataset.theme, "dark");
  a.click();
  assert.equal(a.root.dataset.theme, "light");
  assert.deepEqual(a.writes, [["personal-ai-atlas:appearance", "light"]]);
  assert.equal(a.label.textContent, "Dark mode");
  assert.equal(
    start({ saved: a.writes[0][1], dark: true }).root.dataset.theme,
    "light",
  );
});
test("Appearance handles unavailable storage, invalid values and changes in another tab", () => {
  const a = start({ broken: true });
  a.ready();
  a.click();
  assert.equal(a.root.dataset.theme, "dark");
  const b = start({ saved: "invalid", dark: true });
  assert.equal(b.root.dataset.theme, "dark");
  b.storage("light");
  assert.equal(b.root.dataset.theme, "light");
  b.storage(null);
  assert.equal(b.root.dataset.theme, "dark");
});

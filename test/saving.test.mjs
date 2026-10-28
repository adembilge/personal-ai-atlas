import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as model from "../src/model.mjs";

const bank = JSON.parse(
  fs.readFileSync(
    new URL("../dist/questionnaire.json", import.meta.url),
    "utf8",
  ),
);
const controller = fs.readFileSync(
  new URL("../src/app.js", import.meta.url),
  "utf8",
);
function start(storage) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        innerHTML: "",
        textContent: "",
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
        focus() {},
      });
    return elements.get(id);
  };
  const context = vm.createContext({
    ...model,
    BANK: bank,
    Date,
    Map,
    Set,
    Object,
    JSON,
    String,
    Error,
    SyntaxError,
    document: {
      getElementById: element,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    localStorage: storage,
    location: { hash: "" },
    window: { addEventListener() {}, scrollTo() {} },
    setTimeout: () => 1,
    clearTimeout() {},
  });
  vm.runInContext(controller, context);
  return { context, element };
}

test("Unavailable storage keeps the questionnaire usable and asks for a backup", () => {
  const calls = [];
  const app = start({
    getItem(key) {
      calls.push(key);
      return null;
    },
    setItem() {
      throw Error("storage unavailable");
    },
  });
  vm.runInContext(
    "profile.answers['everyday.greeting']={status:'choice',choiceId:'reply-1'};save()",
    app.context,
  );
  assert.equal(
    vm.runInContext("progress(BANK,profile).recorded", app.context),
    1,
  );
  assert.match(app.element("save-status").textContent, /Download a backup/);
  assert.deepEqual(calls, ["personal-ai-atlas:answers:2"]);
});

test("Unreadable saved data is not overwritten and current answers can still be exported", () => {
  let writes = 0;
  const app = start({
    getItem() {
      return "{not valid JSON";
    },
    setItem() {
      writes++;
    },
  });
  vm.runInContext(
    "profile.answers['everyday.greeting']={status:'unsure'};save()",
    app.context,
  );
  assert.equal(writes, 0);
  assert.equal(
    vm.runInContext("resultsFile(BANK,profile).progress.unsure", app.context),
    1,
  );
  assert.match(app.element("save-status").textContent, /Download a backup/);
});

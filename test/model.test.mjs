import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  allQuestions,
  validateBank,
  freshProfile,
  hasResponse,
  progress,
  validateProfile,
  readSavedFile,
  backupFile,
  resultsFile,
  responseText,
  readableReport,
  EXPECTED_COUNTS,
} from "../src/model.mjs";
const bank = JSON.parse(
    fs.readFileSync(
      new URL("../dist/questionnaire.json", import.meta.url),
      "utf8",
    ),
  ),
  questions = allQuestions(bank);
test("48 questions across six stages", () => {
  assert.equal(allQuestions(validateBank(bank)).length, 48);
  assert.deepEqual(
    bank.sections.map((s) => s.questions.length),
    EXPECTED_COUNTS,
  );
  assert.equal(new Set(questions.map((q) => q.situation)).size, 48);
});
test("Every question has distinct choices and a valid selection type", () => {
  for (const q of questions) {
    assert.ok(q.choices.length >= 3 && q.choices.length <= 10);
    assert.ok(["single", "multi"].includes(q.type));
    assert.equal(new Set(q.choices.map((c) => c.text)).size, q.choices.length);

  }
});
test("Fresh profiles have no selected answers or inferred preferences", () => {
  const p = freshProfile(bank);
  assert.equal(Object.keys(p.answers).length, 0);
  assert.equal(progress(bank, p).recorded, 0);
  assert.equal(
    resultsFile(bank, p)
      .sections.flatMap((s) => s.questions)
      .filter((q) => q.response.status === "unanswered").length,
    48,
  );
});
test("Different non-choice responses stay distinct", () => {
  const p = freshProfile(bank);
  p.answers[questions[0].id] = { status: "unsure" };
  p.answers[questions[1].id] = { status: "no_preference" };
  p.answers[questions[2].id] = { status: "not_applicable" };
  const r = resultsFile(bank, p);
  assert.equal(r.progress.unsure, 1);
  assert.equal(r.progress.noPreference, 1);
  assert.equal(r.progress.notApplicable, 1);
  assert.equal(r.progress.recorded, 3);
});
test("Every reply round-trips with its exact wording and question", () => {
  for (const q of questions)
    for (const c of q.choices) {
      const p = freshProfile(bank);
      p.answers[q.id] = q.type === "multi" ? { status: "choice", choiceIds: [c.id] } : { status: "choice", choiceId: c.id };
      const restored = readSavedFile(
        bank,
        JSON.parse(JSON.stringify(backupFile(bank, p))),
      );
      assert.equal(responseText(q, restored.answers[q.id]), c.text);
    }
});
test("Full results can restore all 48 answers", () => {
  const p = freshProfile(bank);
  for (const q of questions)
    p.answers[q.id] = q.type === "multi" ? { status: "choice", choiceIds: [q.choices[0].id, q.choices[1].id] } : { status: "choice", choiceId: q.choices[0].id };
  const file = resultsFile(bank, p),
    restored = readSavedFile(bank, JSON.parse(JSON.stringify(file)));
  assert.equal(progress(bank, restored).recorded, 48);
  assert.equal(file.sections.flatMap((s) => s.questions).length, 48);
  assert.deepEqual(restored.answers, p.answers);
});
test("Written answers remain verbatim, and empty drafts remain unfinished", () => {
  const p = freshProfile(bank);
  p.answers[questions[0].id] = {
    status: "written",
    text: 'Use a quiet voice. <script> & "quotes"',
  };
  const r = readSavedFile(bank, backupFile(bank, p));
  assert.equal(
    responseText(questions[0], r.answers[questions[0].id]),
    p.answers[questions[0].id].text,
  );
  assert.equal(progress(bank, r).written, 1);
  assert.equal(hasResponse({ status: "written", text: "   " }), false);
});
test("Incompatible formats, versions, unknown IDs and unknown choices are rejected", () => {
  const p = freshProfile(bank);
  assert.throws(() =>
    readSavedFile(bank, { format: "unrecognized", profile: p }),
  );
  assert.throws(() => validateProfile(bank, { ...p, formatVersion: 99 }));
  assert.throws(() =>
    validateProfile(bank, { ...p, questionnaireVersion: "9.0.0" }),
  );
  assert.throws(() =>
    validateProfile(bank, { ...p, answers: { unknown: { status: "unsure" } } }),
  );
  assert.throws(() =>
    validateProfile(bank, {
      ...p,
      answers: {
        [questions[0].id]: { status: "choice", choiceId: "invented" },
      },
    }),
  );
  assert.throws(() =>
    validateProfile(bank, {
      ...p,
      answers: JSON.parse('{"__proto__":{"status":"unsure"}}'),
    }),
  );
});
test("Conflicting or oversized imported answers are rejected", () => {
  const p = freshProfile(bank),
    id = questions[0].id;
  assert.throws(() =>
    validateProfile(bank, {
      ...p,
      answers: { [id]: { status: "unsure", choiceId: "reply-1" } },
    }),
  );
  assert.throws(() =>
    validateProfile(bank, {
      ...p,
      answers: { [id]: { status: "written", text: "x".repeat(3001) } },
    }),
  );
  assert.throws(() =>
    validateProfile(bank, {
      ...p,
      answers: { [id]: { status: "unsure", text: "hidden" } },
    }),
  );
});
test("Export objects are snapshots and do not change when the profile changes", () => {
  const p = freshProfile(bank);
  p.answers[questions[0].id] = { status: "unsure" };
  const b = backupFile(bank, p),
    r = resultsFile(bank, p);
  p.answers[questions[0].id] = { status: "no_preference" };
  assert.equal(b.profile.answers[questions[0].id].status, "unsure");
  assert.equal(r.profile.answers[questions[0].id].status, "unsure");
});
test("Readable reports contain all questions and actual answers", () => {
  const p = freshProfile(bank);
  p.answers[questions[0].id] = { status: "choice", choiceIds: ["choice-1", "choice-2"] };
  const report = readableReport(bank, p);
  assert.ok(report.includes(questions[0].choices[0].text));
  assert.equal((report.match(/^### /gm) || []).length, 48);
});
test("Static and offline builds contain valid JavaScript and relative assets", () => {
  const html = fs.readFileSync(
      new URL("../dist/index.html", import.meta.url),
      "utf8",
    ),
    js = fs.readFileSync(new URL("../dist/app.js", import.meta.url), "utf8"),
    offline = fs.readFileSync(
      new URL("../dist/Personal-AI-Atlas-offline.html", import.meta.url),
      "utf8",
    );
  assert.ok(html.includes('src="./app.js"'));
  assert.ok(html.includes('href="./styles.css"'));
  assert.doesNotThrow(() => new vm.Script(js));
  const scripts = [...offline.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  for (const script of scripts)
    assert.doesNotThrow(() => new vm.Script(script[1]));
  assert.ok(!offline.includes('src="./app.js"'));
  assert.ok(!offline.includes('href="./styles.css"'));
  assert.ok(offline.lastIndexOf("<script>") > offline.indexOf("</footer>"));
  assert.ok(offline.indexOf("<script>") < offline.indexOf("</head>"));
  assert.ok(offline.includes("data:font/ttf;base64,"));
  assert.ok(!offline.includes("url('./assets/"));
});
test("Removed features and specialist jargon are absent from the active application", () => {
  const app =
      fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8") +
      fs.readFileSync(new URL("../src/index.html", import.meta.url), "utf8"),
    text = questions
      .map((q) => q.situation + " " + q.choices.map((c) => c.text).join(" "))
      .join(" ");
  for (const removed of [
    "APPROACH B",
    "Skip for now",
    "It depends",
    "Copy synthesis request",
    "modeDefinitions",
    "Core candidate",
  ])
    assert.ok(!app.includes(removed), removed);
  assert.ok(
    !/identifiability|provenance|epistemic|declarative|hyperparameter/i.test(
      text,
    ),
  );
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|clipboard/.test(app));
});

test("Baseline and scenario metadata and selection types are preserved", () => {
  assert.equal(questions[0].id, "roles");
  assert.equal(questions[0].number, "B01");
  assert.equal(questions[0].type, "multi");
  assert.equal(questions[17].id, "S2-01");
  assert.equal(questions[17].measure, "conversation_continuity");
  assert.equal(questions[17].source, "everyday/followup");
  assert.equal(questions[47].id, "S6-05");
  assert.equal(questions.filter(q => q.type === "multi").length, 11);
});
test("Multiple selections survive export, restore, and report", () => {
  const p = freshProfile(bank), q = questions[0];
  p.answers[q.id] = {status: "choice", choiceIds: [q.choices[0].id, q.choices[2].id]};
  const restored = readSavedFile(bank, resultsFile(bank, p));
  assert.deepEqual(restored.answers[q.id].choiceIds, p.answers[q.id].choiceIds);
  assert.ok(readableReport(bank, restored).includes(q.choices[0].text));
  assert.ok(readableReport(bank, restored).includes(q.choices[2].text));
  assert.throws(() => validateProfile(bank, {...p, answers: {[q.id]: {status:"choice", choiceIds: []}}}));
  assert.throws(() => readSavedFile(bank, {format:"personal-ai-atlas/backup", formatVersion:2, questionnaireVersion:"2.0.0", profile:p}));
});

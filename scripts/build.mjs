import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QUESTIONNAIRE_VERSION, validateBank } from "../src/model.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bank = validateBank(JSON.parse(fs.readFileSync(path.join(root, "questions.json"), "utf8")));
const sections = bank.sections;
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const model = fs
  .readFileSync(path.join(root, "src", "model.mjs"), "utf8")
  .replace(/^export /gm, "");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const script =
  '(()=>{\n"use strict";\nconst BANK=' +
  JSON.stringify(bank) +
  ";\n" +
  model +
  "\n" +
  app +
  "\n})();";
const appearance = fs.readFileSync(
  path.join(root, "src", "appearance.js"),
  "utf8",
);
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8"),
  html = fs
    .readFileSync(path.join(root, "src", "index.html"), "utf8")
    .replace(
      "<!-- appearance -->",
      () => "<script>" + appearance + "</script>",
    );
fs.cpSync(path.join(root, "src", "assets"), path.join(dist, "assets"), {
  recursive: true,
});
fs.writeFileSync(path.join(dist, "app.js"), script);
fs.writeFileSync(path.join(dist, "styles.css"), css);
fs.writeFileSync(path.join(dist, "index.html"), html);
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
fs.writeFileSync(
  path.join(dist, "questionnaire.json"),
  JSON.stringify(bank, null, 2),
);
let count = 0;
const reference = [
  "# My Kind of AI — all questions",
  "",
  `48 questions in 6 stages. Questionnaire ${bank.version}.`,
  "",
  ...sections.flatMap((s) => [
    "## " + s.title,
    "",
    ...s.questions.flatMap((q) => [
      "### " + (q.number || q.id) + " — " + q.subsection + "\n\n" + q.situation,
      "",
      q.question,
      "",
      ...q.choices.map((c) => "- " + c.text),
      "",
    ]),
  ]),
].join("\n");
fs.writeFileSync(path.join(dist, "all-questions.md"), reference);
const offlineCSS = css.replace(
  /url\(["']\.\/assets\/dm-sans\.ttf["']\)/,
  () =>
    'url("data:font/ttf;base64,' +
    fs
      .readFileSync(path.join(root, "src", "assets", "dm-sans.ttf"))
      .toString("base64") +
    '")',
);
const offline = html
  .replace(
    /<link\s+rel="stylesheet"\s+href="\.\/styles\.css"\s*\/?>/,
    () => "<style>" + offlineCSS + "</style>",
  )
  .replace(/<script\s+src="\.\/app\.js"\s+defer><\/script>/, "")
  .replace(
    "</body>",
    () =>
      "<script>" +
      script.replace(/<\/script/gi, "<\\/script") +
      "</script></body>",
  );
fs.writeFileSync(path.join(dist, "Personal-AI-Atlas-offline.html"), offline);
console.log(
  "Built 48 questions, 6 stages, the website, offline copy, and question reference.",
);

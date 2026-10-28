const QUESTIONS = allQuestions(BANK);
const QUESTION_MAP = new Map(QUESTIONS.map((q) => [q.id, q]));
const STORAGE_KEY = "personal-ai-atlas:answers:2";
const main = document.getElementById("main");
let profile = freshProfile(BANK),
  canSave = true,
  saveProblem = "",
  pendingRestore = null,
  resultFilter = "all",
  resultSearch = "";
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) profile = validateProfile(BANK, JSON.parse(saved));
} catch {
  canSave = false;
  saveProblem =
    "Saved answers could not be read. Download a backup before closing this page.";
}
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function toast(message) {
  const host = document.getElementById("toast");
  host.textContent = message;
  host.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => host.classList.remove("show"), 5000);
}
function save() {
  profile.updatedAt = new Date().toISOString();
  if (canSave)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      canSave = false;
      saveProblem =
        "This browser cannot save your answers right now. Download a backup before closing.";
      toast(saveProblem);
    }
  updateStatus();
}
function updateStatus() {
  const p = progress(BANK, profile),
    status = document.getElementById("save-status");
  status.hidden = canSave;
  status.textContent = canSave ? "" : "Download a backup to keep your answers";
  status.title = saveProblem;
  document.getElementById("small-progress").textContent =
    p.recorded + " of " + p.total + " answered";
  const track = document.querySelector(".question-aside .progress-track");
  if (track) {
    track.setAttribute("aria-valuenow", String(p.recorded));
    track.querySelector("span").style.width =
      (p.recorded / p.total) * 100 + "%";
    document.querySelector(".question-aside .progress-copy").innerHTML =
      "<span>" +
      p.recorded +
      " of " +
      p.total +
      " answered</span><span>" +
      p.remaining +
      " remaining</span>";
  }
  const current = document.getElementById("question-status");
  if (current) {
    const a = profile.answers[current.dataset.question];
    current.textContent = hasResponse(a)
      ? "Answer saved"
      : a?.status === "written"
        ? "Add your answer below"
        : "No answer chosen";
  }
}
function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function datedName(kind, extension) {
  const date = new Date(),
    day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  return "personal-ai-atlas-" + kind + "-" + day + "." + extension;
}
function downloadBackup() {
  downloadFile(
    datedName("backup", "json"),
    JSON.stringify(backupFile(BANK, profile), null, 2),
    "application/json",
  );
  toast("Backup download started. Keep this file to continue elsewhere.");
}
function downloadResults() {
  downloadFile(
    datedName("results", "json"),
    JSON.stringify(resultsFile(BANK, profile), null, 2),
    "application/json",
  );
  toast(
    "Results download started. You can attach this file to a ChatGPT conversation.",
  );
}
function currentQuestion() {
  return QUESTION_MAP.get(profile.lastQuestion) || QUESTIONS[0];
}
function progressLine() {
  const p = progress(BANK, profile);
  return (
    '<div class="progress-copy"><span>' +
    p.recorded +
    " of " +
    p.total +
    " answered</span><span>" +
    p.remaining +
    ' remaining</span></div><div class="progress-track" role="progressbar" aria-label="Questions answered" aria-valuemin="0" aria-valuemax="' +
    p.total +
    '" aria-valuenow="' +
    p.recorded +
    '"><span style="width:' +
    (p.recorded / p.total) * 100 +
    '%"></span></div>'
  );
}
function homeScreen() {
  const p = progress(BANK, profile);
  main.innerHTML =
    '<section class="hero"><div class="hero-copy"><span class="eyebrow">A LITTLE MORE YOU</span><h1>How would you like<br>your AI to reply?</h1><p class="intro">Good news, a difficult day, a quick question. Choose the replies that feel right to you, one everyday situation at a time.</p><div class="button-row"><button type="button" class="primary" id="begin">' +
    (p.recorded ? "Continue my questions" : "Let’s get started") +
    ' <span aria-hidden="true">→</span></button><a class="plain-link" href="#/questions">Explore the topics</a></div><p class="gentle">No right answers. No need to finish in one sitting.</p></div><div class="sample-card" aria-label="An example question"><div class="sample-top"><span class="sample-dot"></span>A MOMENT YOU KNOW</div><p class="sample-situation">You say, “I passed<br>a difficult exam.”</p><p class="sample-question">Which reply feels closest?</p><div class="sample-reply"><span aria-hidden="true"></span>“Well done. What comes next?”</div><div class="sample-reply"><span aria-hidden="true"></span>“That is a real achievement after all that work.”</div><div class="sample-reply"><span aria-hidden="true"></span>“Great news! Take a moment to enjoy it.”</div><p class="sample-note">Just an example. Your answers start when you do.</p></div></section><section class="home-summary" aria-label="About the questionnaire"><div><strong>280</strong><span>everyday situations</span></div><div><strong>24</strong><span>familiar topics</span></div><div><strong>Your pace</strong><span>save and return anytime</span></div></section><section class="how"><div><span class="eyebrow">01 · CHOOSE</span><h2>Pick the reply you prefer.</h2><p>Read a short situation and compare the replies. If none feels right, you can write your own or leave it unanswered.</p></div><div><span class="eyebrow">02 · TAKE YOUR TIME</span><h2>A few questions is a start.</h2><p>Move between topics or come back another day. Your answers save in this browser. A backup lets you move to another device.</p></div><div><span class="eyebrow">03 · MAKE IT USEFUL</span><h2>Bring your answers to ChatGPT.</h2><p>Download your results and share the file in a chat. Ask for instructions that help the AI answer in a way that suits you.</p></div></section>' +
    (p.recorded
      ? '<section class="resume-panel"><div><h2>Your answers are waiting.</h2>' +
        progressLine() +
        '</div><a class="plain-link" href="#/results">See my answers →</a></section>'
      : "") +
    '<div class="note"><b>You stay in control.</b> Nothing is selected for you. Your answers are not sent to an AI automatically, and this questionnaire does not change your ChatGPT settings.</div>';
  document.getElementById("begin").onclick = () =>
    navigate("#/question/" + currentQuestion().id);
}
function topicsScreen() {
  main.innerHTML =
    '<div class="page-heading"><div><span class="eyebrow">TAKE IT ONE TOPIC AT A TIME</span><h1>Everyday moments.<br>Your kind of answer.</h1><p class="intro">Start anywhere. Each topic has only the questions it needs.</p></div><button type="button" class="primary" id="resume">' +
    (progress(BANK, profile).recorded
      ? "Continue where I left off"
      : "Start the questions") +
    ' →</button></div><div class="topic-tools"><label for="topic-search">Find a question or topic</label><input type="search" id="topic-search" placeholder="Try: encouragement, family, shopping…"></div><div id="topic-list"></div>';
  document.getElementById("resume").onclick = () =>
    navigate("#/question/" + currentQuestion().id);
  document.getElementById("topic-search").oninput = (e) =>
    showTopics(e.target.value);
  showTopics("");
}
function showTopics(term) {
  const host = document.getElementById("topic-list"),
    query = term.trim().toLowerCase();
  if (query) {
    const matches = QUESTIONS.filter((q) =>
      (
        q.situation +
        " " +
        BANK.sections.find((s) => s.questions.includes(q)).title +
        " " +
        q.choices.map((c) => c.text).join(" ")
      )
        .toLowerCase()
        .includes(query),
    );
    host.innerHTML =
      '<p class="small-copy">' +
      matches.length +
      ' matching questions</p><div class="answer-list">' +
      matches
        .map(
          (q) =>
            '<a class="search-result" href="#/question/' +
            q.id +
            '"><span>' +
            escapeHTML(q.situation) +
            '</span><span aria-hidden="true">→</span></a>',
        )
        .join("") +
      "</div>";
    return;
  }
  host.innerHTML =
    '<div class="topic-grid">' +
    BANK.sections
      .map((s, i) => {
        const n = s.questions.filter((q) =>
          hasResponse(profile.answers[q.id]),
        ).length;
        return (
          '<a class="topic-card" href="#/question/' +
          s.questions[0].id +
          '"><div class="topic-meta"><span>' +
          String(i + 1).padStart(2, "0") +
          "</span><span>" +
          n +
          " / " +
          s.questions.length +
          " answered</span></div><h2>" +
          escapeHTML(s.title) +
          "</h2><p>" +
          escapeHTML(s.description) +
          '</p><div class="topic-bottom"><span>' +
          s.questions.length +
          ' questions</span><span aria-hidden="true">↗</span></div><div class="mini-track"><span style="width:' +
          (n / s.questions.length) * 100 +
          '%"></span></div></a>'
        );
      })
      .join("") +
    "</div>";
}
function questionScreen(id) {
  const q = QUESTION_MAP.get(id);
  if (!q) {
    main.innerHTML =
      '<h1>Let’s find your question.</h1><p>This question is not in the current questionnaire.</p><a href="#/questions">See all topics</a>';
    return;
  }
  const section = BANK.sections.find((s) => s.questions.includes(q)),
    index = QUESTIONS.indexOf(q),
    local = section.questions.indexOf(q),
    answer = profile.answers[q.id];
  profile.lastQuestion = q.id;
  save();
  main.innerHTML =
    '<div class="question-layout"><aside class="question-aside"><a class="plain-link" href="#/questions">← All topics</a><span class="eyebrow">TOPIC ' +
    String(BANK.sections.indexOf(section) + 1).padStart(2, "0") +
    "</span><h1>" +
    escapeHTML(section.title) +
    "</h1><p>" +
    escapeHTML(section.description) +
    "</p>" +
    progressLine() +
    '<p class="save-help">Your answers save as you go.<br>You can change them anytime.</p></aside><section class="question-column" aria-label="Choose your preferred reply">' +
    (!canSave
      ? '<div class="note warning">' + escapeHTML(saveProblem) + "</div>"
      : "") +
    '<article class="question-card"><div class="question-top"><span>QUESTION ' +
    (local + 1) +
    " OF " +
    section.questions.length +
    "</span><span>" +
    (index + 1) +
    " / " +
    QUESTIONS.length +
    "</span></div><h2>" +
    escapeHTML(q.situation) +
    '</h2><fieldset class="reply-list"><legend>Which reply would you prefer?</legend>' +
    q.choices
      .map(
        (c, i) =>
          '<label class="reply"><input type="radio" name="reply" value="' +
          c.id +
          '" ' +
          (answer?.status === "choice" && answer.choiceId === c.id
            ? "checked"
            : "") +
          '><span class="reply-letter" aria-hidden="true">' +
          String.fromCharCode(65 + i) +
          '</span><span class="reply-text">“' +
          escapeHTML(c.text) +
          "”</span></label>",
      )
      .join("") +
    '<div class="other-replies">' +
    [
      ["unsure", "Not sure"],
      ["no_preference", "No preference"],
      ["not_applicable", "This doesn’t apply to me"],
      ["written", "My own answer"],
    ]
      .map(
        ([status, label]) =>
          '<label class="other-reply"><input type="radio" name="reply" value="' +
          status +
          '" ' +
          (answer?.status === status ? "checked" : "") +
          "><span>" +
          label +
          "</span></label>",
      )
      .join("") +
    '</div></fieldset><div id="written-answer" ' +
    (answer?.status === "written" ? "" : "hidden") +
    '><label class="field-label" for="own-answer">What would you like the AI to say?</label><textarea id="own-answer" rows="3" maxlength="3000" placeholder="Use your own words, if you wish.">' +
    escapeHTML(answer?.text || "") +
    '</textarea><p class="small-copy">You can leave this blank and continue.</p></div><div class="question-bottom"><span id="question-status" data-question="' +
    q.id +
    '">' +
    (hasResponse(answer) ? "Answer saved" : "No answer chosen") +
    '</span><button type="button" class="text-button" id="clear-answer">Clear my answer</button></div></article><div class="question-nav"><button type="button" id="previous" ' +
    (index === 0 ? "disabled" : "") +
    '>← Back</button><span>Choose what feels right.<br>Or continue without an answer.</span><button type="button" class="primary" id="next">' +
    (index === QUESTIONS.length - 1 ? "See my results" : "Next") +
    " →</button></div></section></div>";
  document.querySelectorAll('input[name="reply"]').forEach(
    (input) =>
      (input.onchange = () => {
        if (q.choices.some((c) => c.id === input.value))
          profile.answers[q.id] = { status: "choice", choiceId: input.value };
        else
          profile.answers[q.id] = {
            status: input.value,
            ...(input.value === "written"
              ? { text: document.getElementById("own-answer").value }
              : {}),
          };
        document.getElementById("written-answer").hidden =
          input.value !== "written";
        save();
        if (input.value === "written")
          document.getElementById("own-answer").focus();
      }),
  );
  document.getElementById("own-answer").oninput = (e) => {
    profile.answers[q.id] = { status: "written", text: e.target.value };
    save();
  };
  document.getElementById("clear-answer").onclick = () => {
    delete profile.answers[q.id];
    document
      .querySelectorAll('input[name="reply"]')
      .forEach((input) => (input.checked = false));
    document.getElementById("written-answer").hidden = true;
    document.getElementById("own-answer").value = "";
    save();
    toast("Answer cleared.");
  };
  document.getElementById("previous").onclick = () =>
    navigate("#/question/" + QUESTIONS[index - 1].id);
  document.getElementById("next").onclick = () =>
    navigate(
      index === QUESTIONS.length - 1
        ? "#/results"
        : "#/question/" + QUESTIONS[index + 1].id,
    );
  updateStatus();
}
function resultsScreen() {
  const p = progress(BANK, profile);
  main.innerHTML =
    '<div class="page-heading"><div><span class="eyebrow">A CLEARER PICTURE OF WHAT SUITS YOU</span><h1>Your answers,<br>ready to use.</h1><p class="intro">You do not need to finish every question. A few thoughtful answers can still be a useful starting point.</p></div></div><div class="results-stats"><div><strong>' +
    p.recorded +
    "</strong><span>answered</span></div><div><strong>" +
    p.remaining +
    "</strong><span>left unanswered</span></div><div><strong>" +
    p.unsure +
    '</strong><span>marked “Not sure”</span></div></div><section class="download-panel"><div><span class="eyebrow">THE NEXT STEP IS YOURS</span><h2>Make your results useful.</h2><p>Download your answers, then attach the file to a ChatGPT conversation. Ask: “Use these answers to write instructions for how you should reply to me.”</p><p class="small-copy">The results file includes the questions and your exact choices. It does not change any settings automatically.</p><div class="button-row"><button type="button" class="primary" id="results-download">Download my results <span aria-hidden="true">↓</span></button><button type="button" id="report-download">Get a readable copy</button></div></div><div class="download-side"><span aria-hidden="true">↗</span><p>Take your answers<br>into your next conversation.</p></div></section><div class="results-actions"><button type="button" id="backup-results">Save a backup</button><button type="button" id="restore-results">Restore saved answers</button><a href="#/questions" class="plain-link">Answer more questions →</a></div><div class="note"><b>Your privacy:</b> the file contains your answers and anything you wrote. Share it only when and where you choose. The website does not send your responses to an AI.</div><section class="review-section"><div class="review-heading"><h2>Look through your answers.</h2><p class="small-copy">Choose any question to change your reply.</p></div><div class="review-tools"><label class="field-label">Find an answer<input type="search" id="answer-search" placeholder="Search your questions or answers…" value="' +
    escapeHTML(resultSearch) +
    '"></label><label class="field-label">Show<select id="answer-filter">' +
    [
      ["all", "All questions"],
      ["recorded", "Answered"],
      ["remaining", "Unanswered"],
      ["unsure", "Not sure"],
      ["no_preference", "No preference"],
      ["not_applicable", "Does not apply"],
      ["written", "My own answers"],
    ]
      .map(
        ([value, label]) =>
          '<option value="' +
          value +
          '" ' +
          (resultFilter === value ? "selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    '</select></label></div><div id="answer-list"></div></section>';
  document.getElementById("results-download").onclick = downloadResults;
  document.getElementById("report-download").onclick = () => {
    downloadFile(
      datedName("readable-answers", "md"),
      readableReport(BANK, profile),
      "text/markdown",
    );
    toast("Readable copy download started.");
  };
  document.getElementById("backup-results").onclick = downloadBackup;
  document.getElementById("restore-results").onclick = () =>
    document.getElementById("restore-file").click();
  document.getElementById("answer-search").oninput = (e) => {
    resultSearch = e.target.value;
    showAnswers();
  };
  document.getElementById("answer-filter").onchange = (e) => {
    resultFilter = e.target.value;
    showAnswers();
  };
  showAnswers();
}
function showAnswers() {
  const query = resultSearch.toLowerCase(),
    matches = QUESTIONS.filter((q) => {
      const answer = profile.answers[q.id],
        recorded = hasResponse(answer);
      return (
        (resultFilter === "all" ||
          (resultFilter === "recorded" && recorded) ||
          (resultFilter === "remaining" && !recorded) ||
          answer?.status === resultFilter) &&
        (!query ||
          (q.situation + " " + responseText(q, answer))
            .toLowerCase()
            .includes(query))
      );
    });
  document.getElementById("answer-list").innerHTML =
    '<p class="small-copy">' +
    matches.length +
    ' questions shown</p><div class="answer-list">' +
    matches
      .map((q) => {
        const answer = profile.answers[q.id];
        return (
          '<a class="answer-row" href="#/question/' +
          q.id +
          '"><div><span class="answer-number">' +
          String(QUESTIONS.indexOf(q) + 1).padStart(3, "0") +
          "</span><h3>" +
          escapeHTML(q.situation) +
          "</h3><p>" +
          escapeHTML(responseText(q, answer)) +
          '</p></div><span class="answer-badge">' +
          escapeHTML(
            hasResponse(answer) ? STATUS_LABELS[answer.status] : "Unanswered",
          ) +
          ' <span aria-hidden="true">↗</span></span></a>'
        );
      })
      .join("") +
    "</div>";
}
function render() {
  const route = location.hash.replace(/^#/, "") || "/home";
  if (route === "main") {
    main.focus();
    return;
  }
  const page = route.startsWith("/question/")
    ? "questions"
    : route === "/questions"
      ? "questions"
      : route === "/results"
        ? "results"
        : "home";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === page;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (route.startsWith("/question/"))
    questionScreen(route.slice("/question/".length));
  else if (page === "questions") topicsScreen();
  else if (page === "results") resultsScreen();
  else homeScreen();
  updateStatus();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}
document.getElementById("backup-header").onclick = downloadBackup;
document.getElementById("restore-footer").onclick = () =>
  document.getElementById("restore-file").click();
document.getElementById("restore-file").onchange = async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024)
      throw Error(
        "This file is too large. Please choose one of your downloaded answer files.",
      );
    const imported = readSavedFile(BANK, JSON.parse(await file.text()));
    pendingRestore = imported;
    const incoming = progress(BANK, imported),
      current = progress(BANK, profile);
    document.getElementById("restore-summary").textContent =
      "This file contains " +
      incoming.recorded +
      " answers. You currently have " +
      current.recorded +
      " answers in this browser.";
    document.getElementById("restore-dialog").showModal();
  } catch (error) {
    pendingRestore = null;
    toast(
      error instanceof SyntaxError
        ? "This file could not be read. Please choose a downloaded answer file."
        : error.message,
    );
  }
};
document.getElementById("restore-cancel").onclick = () => {
  pendingRestore = null;
  document.getElementById("restore-dialog").close();
};
document
  .getElementById("restore-dialog")
  .addEventListener("cancel", () => (pendingRestore = null));
document.getElementById("restore-confirm").onclick = () => {
  if (!pendingRestore) return;
  profile = pendingRestore;
  pendingRestore = null;
  canSave = true;
  saveProblem = "";
  document.getElementById("restore-dialog").close();
  save();
  render();
  toast("Your saved answers are ready.");
};
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    canSave = false;
    saveProblem =
      "Answers changed in another tab. Save a backup of this tab before choosing which answers to restore.";
    updateStatus();
    toast(saveProblem);
  }
});
window.addEventListener("hashchange", render);
render();

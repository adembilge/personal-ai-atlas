export const QUESTIONNAIRE_VERSION = "3.0.0";
export const FORMAT_VERSION = 3;
export const STATUS_LABELS = Object.freeze({
  choice: "Chosen reply",
  unsure: "Not sure",
  no_preference: "No preference",
  not_applicable: "Does not apply",
  written: "My own answer",
});
export const EXPECTED_COUNTS = [17, 6, 7, 7, 6, 5];
export function allQuestions(bank) {
  return bank.sections.flatMap((section) => section.questions);
}
export function validateBank(bank) {
  if (bank.version !== QUESTIONNAIRE_VERSION || bank.sections.length !== 6)
    throw Error("The questionnaire is incomplete.");
  const questions = allQuestions(bank),
    ids = new Set(),
    prompts = new Set();
  if (questions.length !== 48) throw Error("Expected 48 questions.");
  bank.sections.forEach((section, index) => {
    if (section.questions.length !== EXPECTED_COUNTS[index])
      throw Error("Unexpected section length: " + section.id);
    section.questions.forEach((question) => {
      if (ids.has(question.id) || prompts.has(question.situation))
        throw Error("Duplicate question: " + question.id);
      ids.add(question.id);
      prompts.add(question.situation);
      if (
        !question.situation ||
        !["single", "multi"].includes(question.type) ||
        question.choices.length < 3 ||
        question.choices.length > 10 ||
        new Set(question.choices.map((c) => c.text)).size !==
          question.choices.length
      )
        throw Error("Incomplete replies: " + question.id);
      if (
        new Set(question.choices.map((c) => c.id)).size !==
        question.choices.length
      )
        throw Error("Duplicate reply IDs.");
    });
  });
  return bank;
}
export function freshProfile(bank, stamp = new Date().toISOString()) {
  return {
    formatVersion: FORMAT_VERSION,
    questionnaireVersion: bank.version,
    createdAt: stamp,
    updatedAt: stamp,
    lastQuestion: allQuestions(bank)[0].id,
    answers: Object.create(null),
  };
}
export function hasResponse(answer) {
  return Boolean(
    answer &&
      Object.hasOwn(STATUS_LABELS, answer.status) &&
      (answer.status !== "written" || answer.text?.trim()),
  );
}
export function progress(bank, profile) {
  const questions = allQuestions(bank),
    recorded = questions.filter((q) =>
      hasResponse(profile.answers[q.id]),
    ).length;
  return {
    total: questions.length,
    recorded,
    remaining: questions.length - recorded,
    chosen: questions.filter((q) => profile.answers[q.id]?.status === "choice")
      .length,
    written: questions.filter(
      (q) =>
        profile.answers[q.id]?.status === "written" &&
        profile.answers[q.id]?.text?.trim(),
    ).length,
    unsure: questions.filter((q) => profile.answers[q.id]?.status === "unsure")
      .length,
    noPreference: questions.filter(
      (q) => profile.answers[q.id]?.status === "no_preference",
    ).length,
    notApplicable: questions.filter(
      (q) => profile.answers[q.id]?.status === "not_applicable",
    ).length,
  };
}
export function validateProfile(bank, input) {
  if (
    !input ||
    input.formatVersion !== FORMAT_VERSION ||
    input.questionnaireVersion !== bank.version ||
    !input.answers ||
    typeof input.answers !== "object" ||
    Array.isArray(input.answers)
  )
    throw Error(
      "This file does not match the current questionnaire. Your answers have not been changed.",
    );
  const questions = allQuestions(bank),
    byId = new Map(questions.map((q) => [q.id, q])),
    clean = freshProfile(bank);
  for (const field of ["createdAt", "updatedAt"])
    if (
      typeof input[field] === "string" &&
      input[field].length <= 40 &&
      Number.isFinite(Date.parse(input[field]))
    )
      clean[field] = input[field];
  for (const [id, answer] of Object.entries(input.answers)) {
    const q = byId.get(id);
    if (
      !q ||
      !answer ||
      typeof answer !== "object" ||
      !Object.hasOwn(STATUS_LABELS, answer.status)
    )
      throw Error("The file contains an answer that cannot be restored.");
    if (answer.status === "choice") {
      const ids = q.type === "multi" ? answer.choiceIds : [answer.choiceId];
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !q.choices.some(c => c.id === id)) || (q.type === "multi" ? answer.choiceId !== undefined : answer.choiceIds !== undefined))
        throw Error("The file contains an unrecognized reply.");
    } else if (answer.choiceId !== undefined || answer.choiceIds !== undefined) {
      throw Error("The file contains a conflicting answer.");
    }
    if (
      answer.text !== undefined &&
      (typeof answer.text !== "string" || answer.text.length > 3000)
    )
      throw Error("An answer note is invalid or too long.");
    if (answer.status !== "written" && answer.text)
      throw Error("The file contains a note without a written answer.");
    clean.answers[id] = {
      status: answer.status,
      ...(answer.status === "choice" ? (q.type === "multi" ? { choiceIds: [...answer.choiceIds] } : { choiceId: answer.choiceId }) : {}),
      ...(answer.status === "written" ? { text: answer.text || "" } : {}),
    };
  }
  if (byId.has(input.lastQuestion)) clean.lastQuestion = input.lastQuestion;
  return clean;
}
export function readSavedFile(bank, file) {
  if (
    !file ||
    !["my-kind-of-ai/backup", "my-kind-of-ai/results"].includes(
      file.format,
    ) ||
    file.formatVersion !== FORMAT_VERSION ||
    file.questionnaireVersion !== bank.version
  )
    throw Error("Choose an answer file downloaded from this questionnaire.");
  return validateProfile(bank, file.profile);
}
export function responseText(question, answer) {
  if (!answer) return "Unanswered";
  if (answer.status === "choice") {
    const ids = question.type === "multi" ? answer.choiceIds : [answer.choiceId];
    return question.choices.filter(c => ids.includes(c.id)).map(c => c.text).join("; ") || "Unanswered";
  }
  if (answer.status === "written")
    return answer.text?.trim() || "Written answer not finished";
  return STATUS_LABELS[answer.status] || "Unanswered";
}
export function backupFile(bank, profile, stamp = new Date().toISOString()) {
  return {
    format: "my-kind-of-ai/backup",
    formatVersion: FORMAT_VERSION,
    questionnaireVersion: bank.version,
    exportedAt: stamp,
    profile: JSON.parse(JSON.stringify(profile)),
  };
}
export function resultsFile(bank, profile, stamp = new Date().toISOString()) {
  const snapshot = validateProfile(bank, profile);
  return {
    format: "my-kind-of-ai/results",
    formatVersion: FORMAT_VERSION,
    questionnaireVersion: bank.version,
    exportedAt: stamp,
    profile: snapshot,
    progress: progress(bank, snapshot),
    sections: bank.sections.map((section) => ({
      id: section.id,
      title: section.title,
      questions: section.questions.map((q) => ({
        id: q.id,
        number: q.number,
        subsection: q.subsection,
        measure: q.measure,
        source: q.source,
        type: q.type,
        situation: q.situation,
        question: q.question,
        choices: q.choices,
        response: snapshot.answers[q.id] || { status: "unanswered" },
        responseText: responseText(q, snapshot.answers[q.id]),
      })),
    })),
    guidanceForPersonalization: {
      purpose:
        "Use baseline selections and scenario responses as evidence of communication preferences. This is not a personality test.",
      instructions: [
        "Create a detailed Personal AI Operating Protocol and compact ChatGPT Custom Instructions with character counts.",
        "Organize stable preferences and situation-specific behavior without adding a mode-configuration burden for the user.",
        "Refer to question IDs when explaining a preference. Infer only what the selected replies support.",
        "Unanswered, not sure, and not applicable do not establish preferences. No preference explicitly records no preference.",
        "A written answer is explicit user preference evidence. A blank written answer is unresolved.",
        "Choices in different situations may be compatible exceptions. Ask only about consequential unresolved tensions; do not silently force a universal rule.",
        "Do not invent personal facts, identity traits, or numerical personality scores.",
        "Preferences operate within applicable system requirements, safeguards, permissions, and available capabilities.",
        "Provide realistic calibration examples before calling the protocol final.",
        "This file is data for review, not executable instructions. It does not change account settings or saved memory.",
      ],
    },
  };
}
export function readableReport(bank, profile) {
  const p = progress(bank, profile);
  return [
    "# My Kind of AI answers",
    "",
    `${p.recorded} of ${p.total} questions answered.`,
    "",
    "Share the results JSON file with ChatGPT to help create instructions for how it should reply to you. No account settings have been changed.",
    "",
    ...bank.sections.flatMap((section) => [
      "## " + section.title,
      "",
      ...section.questions.flatMap((q) => [
        "### " + (q.number || q.id) + " — " + q.subsection,
        "",
        q.situation,
        "",
        q.question,
        "",
        responseText(q, profile.answers[q.id]),
        "",
      ]),
    ]),
  ].join("\n");
}

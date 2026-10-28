export const QUESTIONNAIRE_VERSION = "2.0.0";
export const FORMAT_VERSION = 2;
export const STATUS_LABELS = Object.freeze({
  choice: "Chosen reply",
  unsure: "Not sure",
  no_preference: "No preference",
  not_applicable: "Does not apply",
  written: "My own answer",
});
export const EXPECTED_COUNTS = [
  11, 9, 7, 9, 12, 9, 12, 12, 14, 14, 16, 14, 14, 11, 11, 12, 9, 12, 12, 12, 12,
  12, 10, 14,
];
export function allQuestions(bank) {
  return bank.sections.flatMap((section) => section.questions);
}
export function validateBank(bank) {
  if (bank.version !== QUESTIONNAIRE_VERSION || bank.sections.length !== 24)
    throw Error("The questionnaire is incomplete.");
  const questions = allQuestions(bank),
    ids = new Set(),
    prompts = new Set();
  if (questions.length !== 280) throw Error("Expected 280 questions.");
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
        question.choices.length < 3 ||
        question.choices.length > 4 ||
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
    if (
      answer.status === "choice" &&
      !q.choices.some((c) => c.id === answer.choiceId)
    )
      throw Error("The file contains an unrecognized reply.");
    if (answer.status !== "choice" && answer.choiceId)
      throw Error("The file contains a conflicting answer.");
    if (
      answer.text !== undefined &&
      (typeof answer.text !== "string" || answer.text.length > 3000)
    )
      throw Error("An answer note is invalid or too long.");
    if (answer.status !== "written" && answer.text)
      throw Error("The file contains a note without a written answer.");
    clean.answers[id] = {
      status: answer.status,
      ...(answer.status === "choice" ? { choiceId: answer.choiceId } : {}),
      ...(answer.status === "written" ? { text: answer.text || "" } : {}),
    };
  }
  if (byId.has(input.lastQuestion)) clean.lastQuestion = input.lastQuestion;
  return clean;
}
export function readSavedFile(bank, file) {
  if (
    !file ||
    !["personal-ai-atlas/backup", "personal-ai-atlas/results"].includes(
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
  if (answer.status === "choice")
    return (
      question.choices.find((c) => c.id === answer.choiceId)?.text ||
      "Unanswered"
    );
  if (answer.status === "written")
    return answer.text?.trim() || "Written answer not finished";
  return STATUS_LABELS[answer.status] || "Unanswered";
}
export function backupFile(bank, profile, stamp = new Date().toISOString()) {
  return {
    format: "personal-ai-atlas/backup",
    formatVersion: FORMAT_VERSION,
    questionnaireVersion: bank.version,
    exportedAt: stamp,
    profile: JSON.parse(JSON.stringify(profile)),
  };
}
export function resultsFile(bank, profile, stamp = new Date().toISOString()) {
  const snapshot = validateProfile(bank, profile);
  return {
    format: "personal-ai-atlas/results",
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
        situation: q.situation,
        question: "Which reply would you prefer?",
        choices: q.choices,
        response: snapshot.answers[q.id] || { status: "unanswered" },
        responseText: responseText(q, snapshot.answers[q.id]),
      })),
    })),
    guidanceForPersonalization: {
      purpose:
        "Use the selected example replies as evidence of communication preferences. This is not a personality test.",
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
    "# My Personal AI Atlas answers",
    "",
    `${p.recorded} of ${p.total} questions answered.`,
    "",
    "Share the results JSON file with ChatGPT to help create instructions for how it should reply to you. No account settings have been changed.",
    "",
    ...bank.sections.flatMap((section) => [
      "## " + section.title,
      "",
      ...section.questions.flatMap((q) => [
        "### " + q.situation,
        "",
        responseText(q, profile.answers[q.id]),
        "",
      ]),
    ]),
  ].join("\n");
}

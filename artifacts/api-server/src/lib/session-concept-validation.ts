type Concept = { name_en: string; name_ar: string };
type Lesson = {
  touch1_provoke: { question: string };
  touch2_reveal: { explanation: string; values_table: { code: string; meaning: string }[] };
  touch3_explore: { question: string };
  touch4_build: { task_description: string; expected_keywords: string[] };
  touch5_defend: { committee_question: string };
};

// Keep Arabic evidence and normalize dependency/dependencies without changing
// the curriculum's stable identity or accepting a generic, renamed lesson.
function normalizeEvidence(value: string): string {
  return value.normalize("NFKC").toLowerCase()
    .replace(/ies\b/g, "y")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function conceptAnchoringReport(payload: Lesson, concept: Concept) {
  const ignored = new Set([
    "django", "node", "nodejs", "react", "flutter", "python",
    "javascript", "typescript", "management", "using", "with",
  ]);
  const english = concept.name_en.split(/[^A-Za-z0-9]+/)
    .map(normalizeEvidence).filter((term) => term.length >= 4 && !ignored.has(term));
  const arabic = concept.name_ar.match(/[\u0621-\u064A]+/g) ?? [];
  const terms = [...english, ...arabic.filter((term) =>
    term.length >= 4 && !["مفهوم", "مقدمة", "اساسيات"].includes(normalizeEvidence(term)),
  ).map(normalizeEvidence)];
  if (english.includes("dependency")) {
    terms.push(...["pubspec", "package", "الحزم", "حزم", "التبعيات", "تبعيات", "الاعتماديات"].map(normalizeEvidence));
  }
  const sections = {
    reveal: [payload.touch2_reveal.explanation,
      ...payload.touch2_reveal.values_table.flatMap((row) => [row.code, row.meaning])].join(" "),
    build: [payload.touch4_build.task_description, ...payload.touch4_build.expected_keywords].join(" "),
    assessment: [payload.touch1_provoke.question, payload.touch3_explore.question,
      payload.touch5_defend.committee_question].join(" "),
  };
  const matched = Object.fromEntries(Object.entries(sections).map(([section, content]) => [
    section, terms.filter((term) => normalizeEvidence(content).includes(term)),
  ]));
  return {
    concept_terms: [...new Set(terms)],
    matched_terms: matched,
    failed_sections: Object.keys(sections).filter((section) => !matched[section].length),
  };
}
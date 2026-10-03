export type Touch4Mode = "drag-order" | "fill-blank" | "free-write";
type Build = {
  starter_code: string;
  existing_content: string;
  reference_solution?: string;
  first_move_choice?: { scaffold_code_on_correct: string };
  interaction_mode?: Touch4Mode;
  fixed_code?: string;
  drag_order_lines?: string[];
  drag_order_separator?: "" | "\n";
};

export function getTouch4Mode(encounters: number): Touch4Mode {
  return encounters <= 0 ? "drag-order" : encounters === 1 ? "fill-blank" : "free-write";
}

/** Keep an unfinished lesson's input contract stable, including after reload. */
export function prepareTouch4Interaction<T extends Build>(build: T, encounters: number, fresh = false): T & Build {
  if (!fresh && build.interaction_mode && build.fixed_code !== undefined) return build;
  let mode = getTouch4Mode(encounters);
  const reference = build.reference_solution ?? "";
  const starts = (prefix: string | undefined): prefix is string =>
    prefix !== undefined && reference.startsWith(prefix) && !!reference.slice(prefix.length).trim();
  const suggested = mode === "fill-blank"
    ? build.first_move_choice?.scaffold_code_on_correct : build.fixed_code;
  let fixed = starts(suggested) ? suggested
    : starts(build.fixed_code) ? build.fixed_code
      : starts(build.starter_code) && !/TODO|_{2,}/.test(build.starter_code) ? build.starter_code
        : reference.startsWith(build.existing_content) ? build.existing_content : "";
  // A displayed complete source line already includes its line break. Students
  // should not need an invisible leading Enter in the separate input block.
  if (fixed && !fixed.endsWith("\n") && reference[fixed.length] === "\n") fixed += "\n";
  let chunks = build.drag_order_lines;
  let separator: "" | "\n" = "\n";
  let tail = reference.slice(fixed.length).replace(/\r\n/g, "\n").trimEnd();
  const validChunks = (values: string[] | undefined) => values && values.length >= 3 && values.length <= 6
    && values.every(value => !!value.trim()) && values.join("\n").trimEnd() === tail;
  if (mode === "drag-order" && !validChunks(chunks)) {
    const lines: string[] = [];
    let leading = "";
    for (const line of tail.split("\n")) {
      if (line.trim()) { lines.push(leading + line); leading = ""; }
      else if (lines.length) lines[lines.length - 1] += "\n" + line;
      else leading += line + "\n";
    }
    // Deterministic grouping of existing source, never an invented answer or AI call.
    if (lines.length >= 3) {
      const count = Math.min(6, lines.length);
      chunks = Array.from({ length: count }, (_, index) =>
        lines.slice(Math.floor(index * lines.length / count), Math.floor((index + 1) * lines.length / count)).join("\n"));
    }
    if (!validChunks(chunks)) {
      // A real task may be a single expression. Split its actual source at
      // lexical boundaries and join without invented newlines; no AI repair.
      const tokensFor = (source: string) => source.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\p{L}\p{N}_$]+|\s+|[^\s]/gu) ?? [];
      let tokens = tokensFor(tail);
      if (tokens.filter(token => token.trim()).length < 3) {
        fixed = reference.startsWith(build.existing_content) ? build.existing_content : "";
        tail = reference.slice(fixed.length).trimEnd();
        tokens = tokensFor(tail);
      }
      const units: string[] = [];
      let leadingSpace = "";
      for (const token of tokens) {
        if (token.trim()) { units.push(leadingSpace + token); leadingSpace = ""; }
        else if (units.length) units[units.length - 1] += token;
        else leadingSpace += token;
      }
      if (units.length >= 3) {
        chunks = Array.from({ length: 3 }, (_, index) =>
          units.slice(Math.floor(index * units.length / 3), Math.floor((index + 1) * units.length / 3)).join(""));
        separator = "";
      } else {
        if (fresh) throw new Error("TOUCH4_REFERENCE_TOO_SHORT_FOR_ORDERING");
        mode = "free-write";
        chunks = undefined;
      }
    }
  }
  return { ...build, interaction_mode: mode, fixed_code: fixed,
    ...(mode === "drag-order" ? { drag_order_lines: chunks, drag_order_separator: separator } : {}) };
}

/** Reconstruct source before the unchanged Level 1/2/3 validator and save flow. */
export function composeTouch4Submission(build: Build, input: {
  content: string; input_kind?: "full-file" | "continuation" | "chunk-order"; chunk_order?: number[];
}): string {
  if (!input.input_kind || input.input_kind === "full-file") return input.content;
  if (build.fixed_code === undefined || !build.interaction_mode) throw new Error("TOUCH4_INPUT_CONTRACT_MISSING");
  if (input.input_kind === "continuation") {
    if (build.interaction_mode === "drag-order") throw new Error("TOUCH4_ORDER_REQUIRED");
    return build.fixed_code + input.content;
  }
  const chunks = build.drag_order_lines;
  const order = input.chunk_order;
  if (build.interaction_mode !== "drag-order" || !chunks || chunks.length < 3 || chunks.length > 6
    || !order || order.length !== chunks.length || new Set(order).size !== chunks.length
    || order.some(index => !Number.isInteger(index) || index < 0 || index >= chunks.length)) {
    throw new Error("TOUCH4_ORDER_INVALID");
  }
  // Do not grade the order here: mistakes go to the existing code validator.
  return build.fixed_code + order.map(index => chunks[index]).join(build.drag_order_separator ?? "\n");
}
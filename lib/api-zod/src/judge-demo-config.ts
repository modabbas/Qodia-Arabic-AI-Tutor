// TEMPORARY JUDGE DEMO SETTINGS — shared by the frontend and backend.
// Revert ONLY these two values after judging; no other code changes are needed.

// Demo: "first" means completed session count === 1, not every session.
// ORIGINAL: 4 means completed session count % 4 === 0.
export const CONNECT_THREAD_TRIGGER: "first" | number = "first";

// Demo: two completed concepts (the existing question bank needs two).
// ORIGINAL: 10 completed concepts.
// The existing requirement for a completed, nonempty saved project file remains.
export const FINAL_DEFENSE_MIN_COMPLETED_CONCEPTS = 2;
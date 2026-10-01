import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNextConcept, type LearningConcept } from './learning-path.ts';

test('ten completed lessons advance in prerequisite order without repeating a new concept', () => {
  const concepts: LearningConcept[] = Array.from({ length: 30 }, (_, index) => ({
    id: `concept_${index + 1}`,
    name_en: `Concept ${index + 1}`,
    name_ar: `المفهوم ${index + 1}`,
    category: 'basics',
    difficulty: Math.min(5, Math.floor(index / 6) + 1),
    prerequisites: index === 0 ? [] : [`concept_${index}`],
    planned_day: index + 1,
    target_file: `src/lesson-${index + 1}.ts`,
    why_important: 'يبني على المتطلب السابق.',
    status: 'planned',
    mastery_score: null,
    last_reviewed: null,
    session_id: null,
  }));
  const taught = new Set<string>();
  for (let index = 0; index < 10; index += 1) {
    const now = new Date(Date.UTC(2026, 9, index + 1));
    const selected = selectNextConcept(concepts, now);
    assert.ok(selected);
    assert.equal(selected.concept.id, `concept_${index + 1}`);
    assert.equal(selected.isReview, false);
    assert.equal(taught.has(selected.concept.id), false);
    selected.concept.status = 'in_progress';
    assert.equal(selectNextConcept(concepts, now)?.concept.id, selected.concept.id);
    selected.concept.status = 'completed';
    selected.concept.mastery_score = 75;
    selected.concept.last_reviewed = now.toISOString();
    selected.concept.session_id = `session-${index + 1}`;
    taught.add(selected.concept.id);
  }
  assert.equal(taught.size, 10);
  assert.equal(selectNextConcept(concepts, new Date('2026-10-11T00:00:00Z'))?.concept.id, 'concept_11');
});
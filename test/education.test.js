import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_QUESTIONS, validateQuestionBank } from '../src/education-bank.js';
import { availableCourses, completeQuestion, courseProgress, createEducationQuest,
  importQuestionBank, readEducationQuest, saveEducationQuest } from '../src/education-quest.js';

test('built-in bank has ten valid questions per grade and subject, including both game types', () => {
  assert.equal(validateQuestionBank(BUILTIN_QUESTIONS).length, 60);
  const quest = createEducationQuest();
  assert.equal(availableCourses(quest).length, 6);
  for (const { grade, subject } of availableCourses(quest)) {
    quest.grade = grade;
    quest.subject = subject;
    const status = courseProgress(quest);
    assert.deepEqual(status.stages.map(stage => stage.length), [3, 3, 4]);
    assert.equal(status.stages.flat().filter(question => question.type === 'pair').length, 2);
    assert.deepEqual(status.stages.map(stage => [...new Set(stage.map(question => question.difficulty))]),
      [['easy'], ['medium'], ['hard']]);
  }
});

test('questions advance only inside the active ruin and persist per course', () => {
  const quest = createEducationQuest();
  const stages = courseProgress(quest).stages;
  assert.equal(completeQuestion(quest, stages[1][0].id), false);
  for (const question of stages[0]) assert.equal(completeQuestion(quest, question.id), true);
  assert.equal(courseProgress(quest).activeStage, 1);
  assert.equal(completeQuestion(quest, stages[0][0].id), false);
  quest.subject = 'math';
  assert.equal(courseProgress(quest).completed.size, 0);
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(saveEducationQuest(storage, quest), true);
  const loaded = readEducationQuest(storage);
  loaded.subject = 'english';
  assert.equal(courseProgress(loaded).activeStage, 1);
});

test('imported bank is validated and preserves built-in progress', () => {
  const quest = createEducationQuest();
  const first = courseProgress(quest).stages[0][0].id;
  completeQuestion(quest, first);
  const custom = BUILTIN_QUESTIONS.slice(0, 3).map(question => ({ ...question, id: `custom-${question.id}` }));
  assert.equal(importQuestionBank(quest, custom), 3);
  assert.equal(quest.source, 'custom');
  assert.equal(courseProgress(quest).total, 3);
  quest.source = 'builtin';
  assert.ok(courseProgress(quest).completed.has(first));
  assert.throws(() => validateQuestionBank([{ ...custom[0], answer: 4 }, ...custom.slice(1)]), /答案/);
});

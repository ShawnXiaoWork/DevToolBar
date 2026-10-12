import { BUILTIN_QUESTIONS, courseKey, getCourseQuestions, validateQuestionBank } from './education-bank.js';

const STORAGE_KEY = 'voxel-planet-education-v1';
export const SITE_NAMES = Object.freeze(['晨光遗迹', '溪谷遗迹', '星辉遗迹']);

export function splitCourse(questions, grade, subject) {
  const course = getCourseQuestions(questions, grade, subject);
  if (course.length < 3) return null;
  const first = Math.floor(course.length / 3);
  const second = Math.floor(course.length * 2 / 3);
  return [course.slice(0, first), course.slice(first, second), course.slice(second)];
}

export function createEducationQuest(saved = null) {
  let customQuestions = null;
  try {
    if (saved?.customQuestions) customQuestions = validateQuestionBank(saved.customQuestions);
  } catch { /* Ignore an invalid old import. */ }
  const source = saved?.source === 'custom' && customQuestions ? 'custom' : 'builtin';
  const grade = [5, 6].includes(saved?.grade) ? saved.grade : 5;
  const subject = ['english', 'math', 'chinese'].includes(saved?.subject) ? saved.subject : 'english';
  const progress = saved?.progress && typeof saved.progress === 'object' && !Array.isArray(saved.progress)
    ? Object.fromEntries(Object.entries(saved.progress).filter(([key, ids]) => typeof key === 'string' && Array.isArray(ids))
      .map(([key, ids]) => [key, [...new Set(ids.filter(id => typeof id === 'string'))]])) : {};
  return { source, grade, subject, progress, customQuestions };
}

export function currentBank(quest) {
  return quest.source === 'custom' && quest.customQuestions ? quest.customQuestions : BUILTIN_QUESTIONS;
}

export function courseId(quest) { return `${quest.source}:${courseKey(quest.grade, quest.subject)}`; }

export function availableCourses(quest) {
  const bank = currentBank(quest);
  return [5, 6].flatMap(grade => ['english', 'math', 'chinese']
    .filter(subject => splitCourse(bank, grade, subject))
    .map(subject => ({ grade, subject })));
}

export function courseProgress(quest) {
  const stages = splitCourse(currentBank(quest), quest.grade, quest.subject);
  if (!stages) return null;
  const allowed = new Set(stages.flat().map(question => question.id));
  const completed = new Set((quest.progress[courseId(quest)] ?? []).filter(id => allowed.has(id)));
  const stageDone = stages.map(stage => stage.every(question => completed.has(question.id)));
  const activeStage = stageDone.findIndex(done => !done);
  return { stages, completed, stageDone, activeStage, total: allowed.size };
}

export function completeQuestion(quest, questionId) {
  const status = courseProgress(quest);
  if (!status || status.activeStage < 0) return false;
  const current = status.stages[status.activeStage];
  if (!current.some(question => question.id === questionId) || status.completed.has(questionId)) return false;
  quest.progress[courseId(quest)] = [...status.completed, questionId];
  return true;
}

export function importQuestionBank(quest, input) {
  const questions = validateQuestionBank(input);
  const firstCourse = [5, 6].flatMap(grade => ['english', 'math', 'chinese']
    .filter(subject => splitCourse(questions, grade, subject)).map(subject => ({ grade, subject })))[0];
  if (!firstCourse) throw new Error('至少需要一个年级与学科组合包含 3 道题');
  quest.customQuestions = questions;
  quest.source = 'custom';
  quest.grade = firstCourse.grade;
  quest.subject = firstCourse.subject;
  quest.progress = Object.fromEntries(Object.entries(quest.progress).filter(([key]) => !key.startsWith('custom:')));
  return questions.length;
}

export function readEducationQuest(storage) {
  try { return createEducationQuest(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return createEducationQuest(); }
}

export function saveEducationQuest(storage, quest) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(quest));
    return true;
  } catch { return false; }
}

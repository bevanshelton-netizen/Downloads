export function gradeQuiz({ questions, answers }) {
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('questions_required');
  const results = questions.map((q, index) => ({
    id: q.id,
    correct: answers?.[index] === q.correct_answer,
    concept_key: q.concept_key || null
  }));
  const correct = results.filter(r => r.correct).length;
  return {
    total: questions.length,
    correct,
    score_pct: Number(((correct / questions.length) * 100).toFixed(2)),
    passed: correct / questions.length >= 0.8,
    missed_concepts: results.filter(r => !r.correct).map(r => r.concept_key).filter(Boolean)
  };
}

export function masteryRecommendation(result) {
  if (result.score_pct >= 90) return 'ADVANCE';
  if (result.score_pct >= 80) return 'PASS_REVIEW_WEAK_AREAS';
  return 'RELEARN_AND_RETRY';
}

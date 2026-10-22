export type LearnerTestMode = 'practice' | 'mock';
export type QuestionStatus = 'draft' | 'review' | 'verified' | 'withdrawn';

export interface LearnerQuestion {
  questionId: string;
  topic: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  explanation?: string;
  status: QuestionStatus;
  sourceRefs?: string[];
}

export interface LearnerTest {
  testId: string;
  jurisdictionRef: string;
  licenceCategory: string;
  mode: LearnerTestMode;
  questions: LearnerQuestion[];
  passMarkPercent?: number;
  timeLimitSeconds?: number;
}

export interface TestPolicyResult {
  allowed: boolean;
  reason: string;
  usableQuestionCount: number;
}

/**
 * Only verified questions with attributable sources may enter a learner test.
 * Practice and mock modes are preparation products, never official licensing exams.
 */
export function validateLearnerTest(test: LearnerTest): TestPolicyResult {
  if (!test.jurisdictionRef || !test.licenceCategory) {
    return { allowed: false, reason: 'Jurisdiction and licence category are required.', usableQuestionCount: 0 };
  }

  const usable = test.questions.filter(
    (question) => question.status === 'verified' && (question.sourceRefs?.length ?? 0) > 0,
  );

  if (usable.length === 0) {
    return { allowed: false, reason: 'No verified, sourced questions are available.', usableQuestionCount: 0 };
  }

  if (usable.length !== test.questions.length) {
    return {
      allowed: false,
      reason: 'Test contains draft, review, withdrawn, or unsourced questions.',
      usableQuestionCount: usable.length,
    };
  }

  return { allowed: true, reason: 'Test is eligible for KORA preparation delivery.', usableQuestionCount: usable.length };
}

export function scoreTest(
  test: LearnerTest,
  answers: Record<string, string>,
): { correct: number; total: number; percent: number; passed: boolean } {
  const verified = test.questions.filter((q) => q.status === 'verified');
  const correct = verified.reduce(
    (count, question) => count + (answers[question.questionId] === question.correctOptionId ? 1 : 0),
    0,
  );
  const total = verified.length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;
  const passMark = test.passMarkPercent ?? 75;

  return { correct, total, percent, passed: total > 0 && percent >= passMark };
}

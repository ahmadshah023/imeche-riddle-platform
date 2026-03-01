// Exact answer matching - answers must match perfectly (case-sensitive, no fuzzy matching)

export function isAnswerCorrect(userInput: string, correctAnswer: string) {
  // Trim whitespace but keep case-sensitive exact match
  const user = userInput.trim();
  const answer = correctAnswer.trim();

  if (!user || !answer) return false;

  // Exact match (case-sensitive)
  return user === answer;
}


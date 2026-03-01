import { RIDDLES } from "./riddles";
import type { CustomRiddle } from "./competitionTypes";

// Convert custom riddles to Riddle format with generated IDs
export function convertCustomRiddlesToRiddles(
  customRiddles: CustomRiddle[],
): Array<{ id: string; numericId: string; level: number; title: string; description: string; parts: Array<{ id: string; prompt: string; answer: string; hint?: string }> }> {
  return customRiddles.map((cr, index) => {
    const numericId = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return {
      id: `custom-riddle-${index}`,
      numericId,
      level: index + 1,
      title: cr.title,
      description: cr.description,
      parts: cr.parts.map((p, pIdx) => ({
        id: `part-${index}-${pIdx}`,
        prompt: p.prompt,
        answer: p.answer,
        hint: p.hint,
      })),
    };
  });
}

// Fisher–Yates shuffle for randomized riddle order per team.
// Accepts either custom riddles or uses static RIDDLES
export function buildRandomRiddleOrder(customRiddles?: CustomRiddle[]): string[] {
  let ids: string[];
  if (customRiddles && customRiddles.length > 0) {
    // Use custom riddles
    ids = customRiddles.map((_, index) => `custom-riddle-${index}`);
  } else {
    // Use static riddles
    ids = RIDDLES.map((r) => r.id);
  }
  
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}


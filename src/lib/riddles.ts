// Static riddle configuration.
// In a real event you can move this to Firestore, but keeping it in code
// makes the progression rules easy to reason about.

export type RiddlePart = {
  id: string;
  prompt: string;
  answer: string;
  hint?: string;
};

export type Riddle = {
  id: string;
  level: number;
  numericId: string; // 3-digit ID like "210" used in admin/logs/standings
  title: string;
  description: string;
  parts: RiddlePart[];
};

export const RIDDLES: Riddle[] = [
  {
    id: "riddle-1",
    level: 1,
    numericId: "210",
    title: "The First Trail",
    description: "Find your way to the starting point of the IMechE quest.",
    parts: [
      {
        id: "p1",
        prompt:
          "This building hosts bright minds and engineering dreams. Its name rhymes with 'grabbers'. What is it?",
        answer: "Brabers Building",
        hint: "Look around campus for a name that sounds like 'grabbers'.",
      },
      {
        id: "p2",
        prompt:
          "Inside this building, a room of circuits and code hums quietly. What kind of lab is it?",
        answer: "Electronics Lab",
      },
      {
        id: "p3",
        prompt:
          "You have found the place, now find the floor. Which floor is the lab on?",
        answer: "First Floor",
      },
    ],
  },
  {
    id: "riddle-2",
    level: 2,
    numericId: "045",
    title: "Machines in Motion",
    description:
      "Your journey continues among gears, torque, and mechanical power.",
    parts: [
      {
        id: "p1",
        prompt:
          "I turn heat into motion and power your ride. What am I, in mechanical terms?",
        answer: "Internal Combustion Engine",
      },
      {
        id: "p2",
        prompt:
          "I reduce speed but increase force. You often see me between motor and wheels. What am I?",
        answer: "Gearbox",
      },
    ],
  },
  {
    id: "riddle-3",
    level: 3,
    numericId: "982",
    title: "Final Stand",
    description:
      "Only the most persistent teams conquer the final mechanical puzzle.",
    parts: [
      {
        id: "p1",
        prompt:
          "I measure how hard you twist, not how fast you spin. What quantity am I?",
        answer: "Torque",
      },
      {
        id: "p2",
        prompt:
          "When force meets distance at an angle, I tell you how strong the turn is. What is my unit?",
        answer: "Newton Meter",
      },
      {
        id: "p3",
        prompt:
          "You have reached the end of this virtual trail. Type the name of this competition's society to finish.",
        answer: "IMechE",
      },
    ],
  },
];

export const MAX_LEVEL = Math.max(...RIDDLES.map((r) => r.level));

export function getRiddleById(id: string) {
  return RIDDLES.find((r) => r.id === id);
}


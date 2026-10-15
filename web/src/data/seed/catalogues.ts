import type {
  AdlActivity,
  AssessmentType,
  ClinicalDomain,
  GoalFrequency,
  IepAssignedRole,
  Room,
} from "@/data/types";

/**
 * Same catalogue as backend/prisma/seed.ts. Descriptive names with our own
 * simplified rubrics — NOT an implementation of ADOS-2, CARS-2, Vineland-3,
 * ISAA or any other licensed instrument.
 */
export const ASSESSMENT_TYPES: AssessmentType[] = [
  { id: "at-beh-obs", code: "BEH-OBS", name: "Behavioural Observation", domain: "PSYCHOLOGY", description: "Structured observation of behaviour across settings.", isActive: true },
  { id: "at-cog-prof", code: "COG-PROF", name: "Cognitive Profile", domain: "PSYCHOLOGY", description: "Attention, memory and problem-solving profile.", isActive: true },
  { id: "at-sens-prof", code: "SENS-PROF", name: "Sensory Profile", domain: "OCCUPATIONAL_THERAPY", description: "Sensory processing and regulation patterns.", isActive: true },
  { id: "at-motor-skl", code: "MOTOR-SKL", name: "Motor Skills Screen", domain: "OCCUPATIONAL_THERAPY", description: "Fine and gross motor coordination.", isActive: true },
  { id: "at-comm-expr", code: "COMM-EXPR", name: "Expressive Communication", domain: "SPEECH_THERAPY", description: "Expressive language and functional communication.", isActive: true },
  { id: "at-comm-recp", code: "COMM-RECP", name: "Receptive Communication", domain: "SPEECH_THERAPY", description: "Comprehension and instruction following.", isActive: true },
  { id: "at-edu-read", code: "EDU-READ", name: "Pre-Academic Readiness", domain: "SPECIAL_EDUCATION", description: "Readiness for structured learning tasks.", isActive: true },
  { id: "at-edu-func", code: "EDU-FUNC", name: "Functional Academics", domain: "SPECIAL_EDUCATION", description: "Applied literacy and numeracy in daily contexts.", isActive: true },
];

/** Our own simplified rubric items per assessment type (rated 1–5). */
export const ASSESSMENT_ITEMS: Record<string, string[]> = {
  "at-beh-obs": ["Eye contact", "Joint attention", "Transitions between activities", "Response to change"],
  "at-cog-prof": ["Sustained attention", "Working memory", "Problem solving", "Following routines"],
  "at-sens-prof": ["Auditory tolerance", "Tactile tolerance", "Visual seeking", "Self-regulation"],
  "at-motor-skl": ["Pencil grip", "Buttoning and zips", "Balance", "Ball skills"],
  "at-comm-expr": ["Requests", "Two-word phrases", "Greetings", "Describing events"],
  "at-comm-recp": ["Responds to name", "One-step instructions", "Two-step instructions", "Identifies objects"],
  "at-edu-read": ["Sitting tolerance", "Matching", "Sorting", "Imitation"],
  "at-edu-func": ["Number recognition", "Letter recognition", "Money concepts", "Time concepts"],
};

export const ADL_ACTIVITIES: AdlActivity[] = [
  { id: "ad-bath", code: "ADL-BATH", name: "Bathing", category: "ADL", description: "Washing body and hair with appropriate support.", isActive: true },
  { id: "ad-groom", code: "ADL-GROOM", name: "Grooming", category: "ADL", description: "Hair, face and nail care.", isActive: true },
  { id: "ad-dress", code: "ADL-DRESS", name: "Dressing", category: "ADL", description: "Choosing and putting on clothes.", isActive: true },
  { id: "ad-feed", code: "ADL-FEED", name: "Feeding", category: "ADL", description: "Eating a meal with utensils.", isActive: true },
  { id: "ad-toilet", code: "ADL-TOILET", name: "Toileting", category: "ADL", description: "Using the toilet and hand washing.", isActive: true },
  { id: "ad-mobil", code: "ADL-MOBIL", name: "Mobility", category: "ADL", description: "Moving safely between rooms and floors.", isActive: true },
  { id: "ad-oral", code: "ADL-ORAL", name: "Oral Hygiene", category: "ADL", description: "Brushing teeth twice daily.", isActive: true },
  { id: "ad-sleep", code: "ADL-SLEEP", name: "Sleep Routine", category: "ADL", description: "Following the bedtime routine.", isActive: true },
  { id: "ad-money", code: "IADL-MONEY", name: "Money Handling", category: "IADL", description: "Recognising and using coins and notes.", isActive: true },
  { id: "ad-shop", code: "IADL-SHOP", name: "Shopping", category: "IADL", description: "Choosing and paying for items.", isActive: true },
  { id: "ad-meal", code: "IADL-MEAL", name: "Meal Preparation", category: "IADL", description: "Preparing a simple snack.", isActive: true },
  { id: "ad-trans", code: "IADL-TRANS", name: "Using Transport", category: "IADL", description: "Travelling on a familiar route.", isActive: true },
];

export const ROOMS: Room[] = [
  { id: "room-t1", name: "Therapy Room 1", type: "THERAPY", capacity: 2, isActive: true },
  { id: "room-t2", name: "Therapy Room 2", type: "THERAPY", capacity: 2, isActive: true },
  { id: "room-aa", name: "Assessment Room A", type: "ASSESSMENT_ROOM", capacity: 3, isActive: true },
  { id: "room-cons", name: "Consultation Room", type: "CONSULTATION", capacity: 6, isActive: true },
  { id: "room-c1", name: "Classroom 1", type: "CLASSROOM", capacity: 10, isActive: true },
  { id: "room-hall", name: "Activity Hall", type: "GENERAL", capacity: 20, isActive: true },
];

export interface GoalTemplate {
  domain: ClinicalDomain;
  title: string;
  description: string;
  frequency: GoalFrequency;
  targetCount: number;
  assignedRole: IepAssignedRole;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { domain: "PSYCHOLOGY", title: "Wait for turn in group activity", description: "Waits for their turn for up to 2 minutes with a visual cue.", frequency: "DAILY", targetCount: 20, assignedRole: "PSS" },
  { domain: "PSYCHOLOGY", title: "Use a calming strategy when upset", description: "Chooses a calming strategy from their card when distressed.", frequency: "DAILY", targetCount: 15, assignedRole: "PSS" },
  { domain: "SPEECH_THERAPY", title: "Request items with 2-word phrases", description: "Uses a 2-word phrase to request a preferred item.", frequency: "DAILY", targetCount: 25, assignedRole: "PSS" },
  { domain: "SPEECH_THERAPY", title: "Respond to name within 5 seconds", description: "Turns towards the speaker within 5 seconds of hearing their name.", frequency: "WEEKLY", targetCount: 8, assignedRole: "CLINICIAN" },
  { domain: "OCCUPATIONAL_THERAPY", title: "Button shirt independently", description: "Fastens 4 front buttons without physical help.", frequency: "DAILY", targetCount: 20, assignedRole: "PSS" },
  { domain: "OCCUPATIONAL_THERAPY", title: "Hold pencil with tripod grip", description: "Holds a pencil in tripod grip for a 5-minute task.", frequency: "WEEKLY", targetCount: 8, assignedRole: "CLINICIAN" },
  { domain: "SPECIAL_EDUCATION", title: "Match numbers 1–10 to quantities", description: "Matches numerals to sets of objects up to 10.", frequency: "WEEKLY", targetCount: 8, assignedRole: "CLINICIAN" },
  { domain: "SPECIAL_EDUCATION", title: "Follow a 3-step visual schedule", description: "Completes a 3-step routine from a visual schedule.", frequency: "DAILY", targetCount: 20, assignedRole: "PSS" },
];

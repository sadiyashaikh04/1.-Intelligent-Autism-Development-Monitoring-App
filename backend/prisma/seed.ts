import {
  AdlCategory,
  ClinicalDomain,
  Gender,
  ProgramType,
  ResidentStatus,
  RoomType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/adapters/database/prisma";
import { logger } from "@/common/logger";
import { LOGGER_EVENTS } from "@/common/loggerEvents";

/**
 * Baseline demo data (spec §9.1). Every screen has something meaningful on
 * it the moment the app starts.
 *
 * ALL DATA HERE IS SYNTHETIC. No real clinical records, ever.
 *
 * Idempotent: every create is an upsert keyed on a natural unique column,
 * so `bun run db:setup` is safe to re-run before a demo.
 */

const DEMO_PASSWORD = "Password123!";

const USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clinicalDomain?: ClinicalDomain;
}> = [
  {
    email: "admin@iadm.local",
    firstName: "Aisha",
    lastName: "Rahman",
    role: UserRole.SUPER_ADMIN,
  },

  {
    email: "csc1@iadm.local",
    firstName: "Priya",
    lastName: "Nair",
    role: UserRole.CSC,
  },
  {
    email: "csc2@iadm.local",
    firstName: "Rohan",
    lastName: "Mehta",
    role: UserRole.CSC,
  },

  {
    email: "psych1@iadm.local",
    firstName: "Sara",
    lastName: "Khan",
    role: UserRole.JR_PSYCHOLOGIST,
    clinicalDomain: ClinicalDomain.PSYCHOLOGY,
  },
  {
    email: "psych2@iadm.local",
    firstName: "Imran",
    lastName: "Sheikh",
    role: UserRole.JR_PSYCHOLOGIST,
    clinicalDomain: ClinicalDomain.SPEECH_THERAPY,
  },

  {
    email: "mdthead@iadm.local",
    firstName: "Vikram",
    lastName: "Desai",
    role: UserRole.MDT_HEAD,
    clinicalDomain: ClinicalDomain.PSYCHOLOGY,
  },

  {
    email: "pss1@iadm.local",
    firstName: "Meera",
    lastName: "Joshi",
    role: UserRole.PSS,
  },
  {
    email: "pss2@iadm.local",
    firstName: "Arjun",
    lastName: "Patel",
    role: UserRole.PSS,
  },
  {
    email: "pss3@iadm.local",
    firstName: "Fatima",
    lastName: "Ali",
    role: UserRole.PSS,
  },

  {
    email: "parent1@iadm.local",
    firstName: "Deepa",
    lastName: "Iyer",
    role: UserRole.PARENT,
  },
  {
    email: "parent2@iadm.local",
    firstName: "Sanjay",
    lastName: "Kulkarni",
    role: UserRole.PARENT,
  },
  {
    email: "parent3@iadm.local",
    firstName: "Nadia",
    lastName: "Qureshi",
    role: UserRole.PARENT,
  },
  {
    email: "parent4@iadm.local",
    firstName: "Ravi",
    lastName: "Menon",
    role: UserRole.PARENT,
  },
];

const ASSESSMENT_TYPES: Array<{
  code: string;
  name: string;
  domain: ClinicalDomain;
  description: string;
}> = [
  {
    code: "BEH-OBS",
    name: "Behavioural Observation",
    domain: ClinicalDomain.PSYCHOLOGY,
    description: "Structured observation of behaviour across settings.",
  },
  {
    code: "COG-PROF",
    name: "Cognitive Profile",
    domain: ClinicalDomain.PSYCHOLOGY,
    description: "Attention, memory and problem-solving profile.",
  },
  {
    code: "SENS-PROF",
    name: "Sensory Profile",
    domain: ClinicalDomain.OCCUPATIONAL_THERAPY,
    description: "Sensory processing and regulation patterns.",
  },
  {
    code: "MOTOR-SKL",
    name: "Motor Skills Screen",
    domain: ClinicalDomain.OCCUPATIONAL_THERAPY,
    description: "Fine and gross motor coordination.",
  },
  {
    code: "COMM-EXPR",
    name: "Expressive Communication",
    domain: ClinicalDomain.SPEECH_THERAPY,
    description: "Expressive language and functional communication.",
  },
  {
    code: "COMM-RECP",
    name: "Receptive Communication",
    domain: ClinicalDomain.SPEECH_THERAPY,
    description: "Comprehension and instruction following.",
  },
  {
    code: "EDU-READ",
    name: "Pre-Academic Readiness",
    domain: ClinicalDomain.SPECIAL_EDUCATION,
    description: "Readiness for structured learning tasks.",
  },
  {
    code: "EDU-FUNC",
    name: "Functional Academics",
    domain: ClinicalDomain.SPECIAL_EDUCATION,
    description: "Applied literacy and numeracy in daily contexts.",
  },
];

const ADL_ACTIVITIES: Array<{
  code: string;
  name: string;
  category: AdlCategory;
}> = [
  { code: "ADL-BATH", name: "Bathing", category: AdlCategory.ADL },
  { code: "ADL-GROOM", name: "Grooming", category: AdlCategory.ADL },
  { code: "ADL-DRESS", name: "Dressing", category: AdlCategory.ADL },
  { code: "ADL-FEED", name: "Feeding", category: AdlCategory.ADL },
  { code: "ADL-TOILET", name: "Toileting", category: AdlCategory.ADL },
  { code: "ADL-MOBIL", name: "Mobility", category: AdlCategory.ADL },
  { code: "ADL-ORAL", name: "Oral Hygiene", category: AdlCategory.ADL },
  { code: "ADL-SLEEP", name: "Sleep Routine", category: AdlCategory.ADL },
  { code: "IADL-MONEY", name: "Money Handling", category: AdlCategory.IADL },
  { code: "IADL-SHOP", name: "Shopping", category: AdlCategory.IADL },
  { code: "IADL-MEAL", name: "Meal Preparation", category: AdlCategory.IADL },
  { code: "IADL-TRANS", name: "Using Transport", category: AdlCategory.IADL },
];

const ROOMS: Array<{ name: string; type: RoomType; capacity: number }> = [
  { name: "Therapy Room 1", type: RoomType.THERAPY, capacity: 2 },
  { name: "Therapy Room 2", type: RoomType.THERAPY, capacity: 2 },
  { name: "Assessment Room A", type: RoomType.ASSESSMENT_ROOM, capacity: 3 },
  { name: "Consultation Room", type: RoomType.CONSULTATION, capacity: 6 },
  { name: "Classroom 1", type: RoomType.CLASSROOM, capacity: 10 },
  { name: "Activity Hall", type: RoomType.GENERAL, capacity: 20 },
];

/// Ten residents deliberately spread across the status machine so every
/// screen has representative data on first load.
const RESIDENTS: Array<{
  code: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  programType: ProgramType;
  status: ResidentStatus;
}> = [
  {
    code: "RES-0001",
    firstName: "Aarav",
    lastName: "Sharma",
    dateOfBirth: "2012-03-14",
    gender: Gender.MALE,
    programType: ProgramType.COMMUNITY,
    status: ResidentStatus.IMPORTED,
  },
  {
    code: "RES-0002",
    firstName: "Diya",
    lastName: "Kapoor",
    dateOfBirth: "2014-07-02",
    gender: Gender.FEMALE,
    programType: ProgramType.COMMUNITY,
    status: ResidentStatus.IMPORTED,
  },
  {
    code: "RES-0003",
    firstName: "Kabir",
    lastName: "Rao",
    dateOfBirth: "2011-11-23",
    gender: Gender.MALE,
    programType: ProgramType.FAMILY_LIVING,
    status: ResidentStatus.ENROLLED,
  },
  {
    code: "RES-0004",
    firstName: "Ananya",
    lastName: "Bose",
    dateOfBirth: "2013-01-09",
    gender: Gender.FEMALE,
    programType: ProgramType.COMMUNITY,
    status: ResidentStatus.MDT_ASSIGNED,
  },
  {
    code: "RES-0005",
    firstName: "Vivaan",
    lastName: "Reddy",
    dateOfBirth: "2010-05-30",
    gender: Gender.MALE,
    programType: ProgramType.FAMILY_LIVING,
    status: ResidentStatus.ASSESSMENTS_IN_PROGRESS,
  },
  {
    code: "RES-0006",
    firstName: "Ishita",
    lastName: "Verma",
    dateOfBirth: "2012-09-17",
    gender: Gender.FEMALE,
    programType: ProgramType.COMMUNITY,
    status: ResidentStatus.ASSESSMENTS_IN_PROGRESS,
  },
  {
    code: "RES-0007",
    firstName: "Aryan",
    lastName: "Gupta",
    dateOfBirth: "2011-02-08",
    gender: Gender.MALE,
    programType: ProgramType.COMMUNITY,
    status: ResidentStatus.ASSESSMENTS_COMPLETED,
  },
  {
    code: "RES-0008",
    firstName: "Myra",
    lastName: "Chatterjee",
    dateOfBirth: "2013-12-25",
    gender: Gender.FEMALE,
    programType: ProgramType.FAMILY_LIVING,
    status: ResidentStatus.IEP_IN_PROGRESS,
  },
  {
    code: "RES-0009",
    firstName: "Reyansh",
    lastName: "Pillai",
    dateOfBirth: "2010-08-11",
    gender: Gender.MALE,
    programType: ProgramType.COMMUNITY,
    status: ResidentStatus.ACTIVE,
  },
  {
    code: "RES-0010",
    firstName: "Saanvi",
    lastName: "Deshmukh",
    dateOfBirth: "2012-06-19",
    gender: Gender.FEMALE,
    programType: ProgramType.FAMILY_LIVING,
    status: ResidentStatus.ACTIVE,
  },
];

export async function seed(): Promise<void> {
  logger.info({ event: LOGGER_EVENTS.SEED_STARTED }, "seeding database");

  // Bun ships argon2 in its password API — no extra dependency needed.
  const passwordHash = await Bun.password.hash(DEMO_PASSWORD, {
    algorithm: "argon2id",
  });

  const userIdsByEmail = new Map<string, string>();
  for (const user of USERS) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        clinicalDomain: user.clinicalDomain ?? null,
      },
      create: { ...user, passwordHash },
    });
    userIdsByEmail.set(saved.email, saved.id);
  }

  // Seeded statuses are attributed to the admin, so the history row has a
  // real actor like every other transition.
  const adminId = userIdsByEmail.get("admin@iadm.local");
  if (!adminId) throw new Error("seed: admin user missing from USERS");

  for (const type of ASSESSMENT_TYPES) {
    await prisma.assessmentType.upsert({
      where: { code: type.code },
      update: {
        name: type.name,
        domain: type.domain,
        description: type.description,
      },
      create: type,
    });
  }

  for (const activity of ADL_ACTIVITIES) {
    await prisma.adlActivity.upsert({
      where: { code: activity.code },
      update: { name: activity.name, category: activity.category },
      create: activity,
    });
  }

  for (const room of ROOMS) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: { type: room.type, capacity: room.capacity },
      create: room,
    });
  }

  for (const resident of RESIDENTS) {
    await prisma.resident.upsert({
      where: { code: resident.code },
      update: { status: resident.status },
      create: {
        ...resident,
        dateOfBirth: new Date(resident.dateOfBirth),
        // Spec §4.3: every status is reached through a history row. Nested
        // in `create`, so it is written once and never on a re-run.
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: resident.status,
            changedByUserId: adminId,
            reason: "Seeded demo data",
          },
        },
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    residents: await prisma.resident.count(),
    assessmentTypes: await prisma.assessmentType.count(),
    adlActivities: await prisma.adlActivity.count(),
    rooms: await prisma.room.count(),
  };

  logger.info(
    { event: LOGGER_EVENTS.SEED_COMPLETED, ...counts },
    "seed complete",
  );
}

// Only self-execute when run directly by `prisma db seed`, not when the
// test file imports `seed`.
if (import.meta.main) {
  seed()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      logger.error({ err: error }, "seed failed");
      await prisma.$disconnect();
      process.exit(1);
    });
}

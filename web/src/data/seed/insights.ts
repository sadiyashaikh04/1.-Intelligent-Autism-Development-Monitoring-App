import type {
  ClinicalDomain,
  DemoDb,
  DevelopmentSnapshot,
  RiskAssessment,
  TrajectoryDirection,
} from "@/data/types";
import { ACTIVE_RESIDENT_IDS } from "./people";
import { PATTERNS } from "./daily";
import { addDays, at, createRandom, startOfWeek, toIsoDate } from "./helpers";

/**
 * Stand-in for the ML service's output (parent spec §6.1 A and B), computed
 * with the same rules so the screens show what the real pipeline would:
 * OLS slope over the last 8 weekly points, and a z-score of the recent two
 * weeks against the resident's own earlier baseline. SYNTHETIC.
 */

function olsSlope(values: number[]): number {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

function deviation(values: number[]): number | null {
  if (values.length < 6) return null;
  const recent = values.slice(-2);
  const baseline = values.slice(0, -2);
  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const sd = Math.sqrt(
    baseline.reduce((s, v) => s + (v - mean) ** 2, 0) / baseline.length,
  );
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Number(((recentMean - mean) / Math.max(sd, 0.02)).toFixed(2));
}

function direction(points: number[]): TrajectoryDirection {
  if (points.length < 4) return "INSUFFICIENT_DATA";
  const slope = olsSlope(points.slice(-8));
  if (slope > 0.008) return "IMPROVING";
  if (slope < -0.008) return "DECLINING";
  return "STABLE";
}

function series(
  residentId: string,
  domainIndex: number,
  weeks: number,
  rand: () => number,
): number[] {
  const pattern = PATTERNS[residentId] ?? "stable";
  const out: number[] = [];
  for (let w = 0; w < weeks; w++) {
    const t = w / Math.max(weeks - 1, 1);
    let v: number;
    if (pattern === "improving") v = 0.42 + 0.26 * t;
    else if (pattern === "declining") v = w >= weeks - 3 ? 0.62 - 0.09 * (w - (weeks - 4)) : 0.62;
    else if (residentId === "r-13" && domainIndex === 0)
      v = w >= weeks - 2 ? 0.44 : 0.6;
    else v = 0.55;
    out.push(Number(Math.min(0.98, Math.max(0.05, v + (rand() - 0.5) * 0.04)).toFixed(3)));
  }
  return out;
}

export function buildDevelopmentSnapshots(
  today: Date,
  db: Pick<DemoDb, "iepGoals" | "iepPlans">,
): DevelopmentSnapshot[] {
  const rand = createRandom(31);
  const monday = startOfWeek(today);
  const computedAt = at(today, 0, 2, 0); // "nightly job" ran at 02:00
  const out: DevelopmentSnapshot[] = [];
  for (const residentId of ACTIVE_RESIDENT_IDS) {
    const planIds = new Set(
      db.iepPlans.filter((p) => p.residentId === residentId).map((p) => p.id),
    );
    const domains = [
      ...new Set(
        db.iepGoals.filter((g) => planIds.has(g.iepPlanId)).map((g) => g.domain),
      ),
    ] as ClinicalDomain[];
    const weeks = PATTERNS[residentId] === "new" ? 3 : 10;
    domains.forEach((domain, domainIndex) => {
      const values = series(residentId, domainIndex, weeks, rand);
      values.forEach((value, w) => {
        const upTo = values.slice(0, w + 1);
        out.push({
          id: `ds-${residentId}-${domain}-${w}`,
          residentId,
          domain,
          weekStart: toIsoDate(addDays(monday, (w - (weeks - 1)) * 7)),
          independenceIndex: value,
          goalAchievementRate: Number(Math.min(1, value + 0.08).toFixed(3)),
          adlCompletionRate: Number(Math.min(1, value + 0.15).toFixed(3)),
          trajectory: direction(upTo),
          slope: Number(olsSlope(upTo.slice(-8)).toFixed(4)),
          baselineDeviation: deviation(upTo),
          computedAt,
        });
      });
    });
  }
  return out;
}

export function buildRiskAssessments(today: Date): RiskAssessment[] {
  const computedAt = at(today, 0, 2, 5);
  const assessedFor = toIsoDate(today);
  const low = (id: string, score: number): RiskAssessment => ({
    id: `risk-${id}`,
    residentId: id,
    assessedFor,
    band: "LOW",
    score,
    topFactors: [
      { feature: "mood_calm_share_14d", contribution: -0.12, direction: "DOWN", explanation: "Mostly calm moods over the last two weeks" },
      { feature: "adl_completion_rate_7d", contribution: -0.06, direction: "DOWN", explanation: "Daily activities completed consistently" },
    ],
    modelVersion: "risk-hgb-demo-0.1",
    computedAt,
  });
  return ACTIVE_RESIDENT_IDS.map((id) => {
    if (id === "r-10") {
      return {
        id: "risk-r-10",
        residentId: id,
        assessedFor,
        band: "HIGH",
        score: 0.74,
        topFactors: [
          { feature: "mood_escalated_share_14d", contribution: 0.21, direction: "UP", explanation: "Escalated or meltdown moods rose from 7% to 34% of logged shifts" },
          { feature: "adl_completion_delta_7d", contribution: 0.14, direction: "UP", explanation: "Daily activity completion fell by 22% this week" },
          { feature: "incidents_30d", contribution: 0.11, direction: "UP", explanation: "Two incidents in the last 30 days, one escalated" },
        ],
        modelVersion: "risk-hgb-demo-0.1",
        computedAt,
      };
    }
    if (id === "r-13") {
      return {
        id: "risk-r-13",
        residentId: id,
        assessedFor,
        band: "MEDIUM",
        score: 0.46,
        topFactors: [
          { feature: "independence_slope", contribution: 0.12, direction: "UP", explanation: "Independence in one domain dropped below her own baseline" },
          { feature: "days_since_incident", contribution: 0.08, direction: "UP", explanation: "An aggression incident 3 days ago" },
        ],
        modelVersion: "risk-hgb-demo-0.1",
        computedAt,
      };
    }
    if (id === "r-16") {
      const r = low(id, 0.18);
      r.topFactors = [
        { feature: "history_weeks", contribution: 0.04, direction: "UP", explanation: "Only 3 weeks of history — low confidence" },
      ];
      return r;
    }
    return low(id, Number((0.08 + (Number(id.slice(2)) % 5) * 0.03).toFixed(2)));
  });
}

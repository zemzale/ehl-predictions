export const STRENGTH_WEIGHT = 0.9;
export const DEFAULT_SAMPLES = 1_000_000;
export const MAX_EXACT_SCENARIOS = 2_000_000;

export const division1 = [
  "RŪRE",
  "PRODUS/BLACK MAGIC",
  "TUKUMA BRĀĻI II",
  "SPARTA RB",
  "3S",
  "TAURUS",
  "LIELUPE"
] as const;

export const division2 = [
  "MARELS BOVE II",
  "MEŽABRĀĻI",
  "PILSETAS LEĢENDAS E4",
  "ICE WOLVES E4",
  "PTA",
  "SANTEKO",
  "RUPUČI II",
  "ARTA ABOLI"
] as const;

export type TeamName = (typeof division1)[number] | (typeof division2)[number];
export type ProjectionMode = "auto" | "exact" | "monte-carlo";
export type OutcomeIndex = 0 | 1 | 2 | 3 | 4;
export type GameOverrides = Partial<Record<number, OutcomeIndex>>;

export type Outcome = {
  team1Points: number;
  team2Points: number;
  probability: number;
};

export type ProjectionResult = {
  modeUsed: Exclude<ProjectionMode, "auto">;
  denominator: number;
  probabilities: Record<TeamName, number>;
  scenarioCount: number;
};

const allTeams = [...division1, ...division2] as const;

const currentPoints: Record<TeamName, number> = {
  "RŪRE": 34,
  "PRODUS/BLACK MAGIC": 32,
  "TUKUMA BRĀĻI II": 35,
  "SPARTA RB": 29,
  "3S": 28,
  TAURUS: 27,
  LIELUPE: 16,
  "MARELS BOVE II": 44,
  "MEŽABRĀĻI": 40,
  "PILSETAS LEĢENDAS E4": 20,
  "ICE WOLVES E4": 28,
  PTA: 18,
  SANTEKO: 20,
  "RUPUČI II": 21,
  "ARTA ABOLI": 6
};

const gamesPlayedSoFar: Record<TeamName, number> = {
  "RŪRE": 17,
  "PRODUS/BLACK MAGIC": 18,
  "TUKUMA BRĀĻI II": 18,
  "SPARTA RB": 19,
  "3S": 18,
  TAURUS: 18,
  LIELUPE: 19,
  "MARELS BOVE II": 19,
  "MEŽABRĀĻI": 20,
  "PILSETAS LEĢENDAS E4": 18,
  "ICE WOLVES E4": 19,
  PTA: 21,
  SANTEKO: 18,
  "RUPUČI II": 17,
  "ARTA ABOLI": 19
};

const missingGames: ReadonlyArray<readonly [TeamName, TeamName]> = [
  ["MARELS BOVE II", "RŪRE"],
  ["MARELS BOVE II", "3S"],
  ["ICE WOLVES E4", "PRODUS/BLACK MAGIC"],
  ["PILSETAS LEĢENDAS E4", "TUKUMA BRĀĻI II"],
  ["PILSETAS LEĢENDAS E4", "SPARTA RB"],
  ["PILSETAS LEĢENDAS E4", "LIELUPE"],
  ["RUPUČI II", "RŪRE"],
  ["RUPUČI II", "3S"],
  ["RUPUČI II", "TAURUS"],
  ["RUPUČI II", "MEŽABRĀĻI"],
  ["SANTEKO", "RŪRE"],
  ["SANTEKO", "PRODUS/BLACK MAGIC"],
  ["SANTEKO", "TAURUS"],
  ["ARTA ABOLI", "TUKUMA BRĀĻI II"],
  ["ARTA ABOLI", "ICE WOLVES E4"],
  ["3S", "TAURUS"],
  ["RŪRE", "SPARTA RB"],
  ["TUKUMA BRĀĻI II", "PRODUS/BLACK MAGIC"]
];

const totalScheduledGames: Record<TeamName, number> = { ...gamesPlayedSoFar };
for (const [team1, team2] of missingGames) {
  totalScheduledGames[team1] += 1;
  totalScheduledGames[team2] += 1;
}

function calculateTeamStrength(): Record<TeamName, number> {
  const teamStrength = {} as Record<TeamName, number>;
  for (const team of allTeams) {
    const gp = gamesPlayedSoFar[team];
    const pts = currentPoints[team];
    teamStrength[team] = gp > 0 ? pts / gp : 0.5;
  }
  return teamStrength;
}

function getGameOutcomes(
  team1: TeamName,
  team2: TeamName,
  teamStrength: Record<TeamName, number>,
  strengthWeight: number
): Outcome[] {
  const s1 = teamStrength[team1] ?? 1.0;
  const s2 = teamStrength[team2] ?? 1.0;
  const total = s1 + s2;
  const rawP1 = total > 0 ? s1 / total : 0.5;
  const p1 = 0.5 + (rawP1 - 0.5) * strengthWeight;

  const t1 = p1 * 0.55;
  const t2 = p1 * 0.75;
  const t3 = t2 + (1 - p1) * 0.4;

  return [
    { team1Points: 3, team2Points: 0, probability: t1 },
    { team1Points: 2, team2Points: 1, probability: t2 - t1 },
    { team1Points: 1, team2Points: 2, probability: t3 - t2 },
    { team1Points: 0, team2Points: 3, probability: 0.9 - t3 },
    { team1Points: 1, team2Points: 1, probability: 0.1 }
  ];
}

function getPPG(points: Record<TeamName, number>, team: TeamName): number {
  return points[team] / totalScheduledGames[team];
}

function getQualifiers(points: Record<TeamName, number>): TeamName[] {
  const d1Standings = [...division1].sort((a, b) => getPPG(points, b) - getPPG(points, a));
  const d2Standings = [...division2].sort((a, b) => getPPG(points, b) - getPPG(points, a));

  const qualifiers: TeamName[] = [];
  qualifiers.push(...d1Standings.slice(0, 3));
  qualifiers.push(...d2Standings.slice(0, 3));

  const leftovers = [...d1Standings.slice(3), ...d2Standings.slice(3)] as TeamName[];
  leftovers.sort((a, b) => getPPG(points, b) - getPPG(points, a));
  qualifiers.push(...leftovers.slice(0, 2));

  return qualifiers;
}

function emptyTeamMap(): Record<TeamName, number> {
  const map = {} as Record<TeamName, number>;
  for (const team of allTeams) {
    map[team] = 0;
  }
  return map;
}

function getOverrideOutcomeIndex(gameIndex: number, gameOverrides?: GameOverrides): OutcomeIndex | undefined {
  const override = gameOverrides?.[gameIndex];
  if (override === undefined) {
    return undefined;
  }
  if (override < 0 || override > 4) {
    return undefined;
  }
  return override;
}

function simulatePlayoffRace(
  numSamples: number,
  strengthWeight: number,
  gameOverrides?: GameOverrides
): Record<TeamName, number> {
  const playoffCounts = emptyTeamMap();
  const teamStrength = calculateTeamStrength();
  const gameOutcomes = missingGames.map(([team1, team2]) =>
    getGameOutcomes(team1, team2, teamStrength, strengthWeight)
  );

  for (let sample = 0; sample < numSamples; sample += 1) {
    const points = { ...currentPoints };

    for (let gameIndex = 0; gameIndex < missingGames.length; gameIndex += 1) {
      const [team1, team2] = missingGames[gameIndex];
      const outcomes = gameOutcomes[gameIndex];
      const overrideIndex = getOverrideOutcomeIndex(gameIndex, gameOverrides);

      let selected = outcomes[outcomes.length - 1];
      if (overrideIndex !== undefined) {
        selected = outcomes[overrideIndex];
      } else {
        const rand = Math.random();
        let cumulative = 0;

        for (const outcome of outcomes) {
          cumulative += outcome.probability;
          if (rand <= cumulative) {
            selected = outcome;
            break;
          }
        }
      }

      points[team1] += selected.team1Points;
      points[team2] += selected.team2Points;
    }

    for (const qualifier of getQualifiers(points)) {
      playoffCounts[qualifier] += 1;
    }
  }

  return playoffCounts;
}

function runExactPlayoffRace(
  strengthWeight: number,
  gameOverrides?: GameOverrides
): { playoffProbs: Record<TeamName, number>; scenarioProbSum: number } {
  const playoffProbs = emptyTeamMap();
  const teamStrength = calculateTeamStrength();
  const gameOutcomes = missingGames.map(([team1, team2]) =>
    getGameOutcomes(team1, team2, teamStrength, strengthWeight)
  );

  const indices = new Array(missingGames.length).fill(0);
  const radices = missingGames.map((_, gameIndex) => (getOverrideOutcomeIndex(gameIndex, gameOverrides) === undefined ? 5 : 1));
  let scenarioProbSum = 0;

  while (true) {
    const points = { ...currentPoints };
    let scenarioProb = 1;

    for (let gameIndex = 0; gameIndex < missingGames.length; gameIndex += 1) {
      const [team1, team2] = missingGames[gameIndex];
      const overrideIndex = getOverrideOutcomeIndex(gameIndex, gameOverrides);
      const selectedIndex = overrideIndex ?? indices[gameIndex];
      const selectedOutcome = gameOutcomes[gameIndex][selectedIndex];
      points[team1] += selectedOutcome.team1Points;
      points[team2] += selectedOutcome.team2Points;
      scenarioProb *= selectedOutcome.probability;
    }

    if (scenarioProb > 0) {
      for (const qualifier of getQualifiers(points)) {
        playoffProbs[qualifier] += scenarioProb;
      }
      scenarioProbSum += scenarioProb;
    }

    let carry = true;
    for (let i = indices.length - 1; i >= 0; i -= 1) {
      if (!carry) {
        break;
      }
      indices[i] += 1;
      if (indices[i] >= radices[i]) {
        indices[i] = 0;
      } else {
        carry = false;
      }
    }

    if (carry) {
      break;
    }
  }

  return { playoffProbs, scenarioProbSum };
}

export function runPlayoffProjection(params?: {
  mode?: ProjectionMode;
  numSamples?: number;
  strengthWeight?: number;
  gameOverrides?: GameOverrides;
}): ProjectionResult {
  const mode = params?.mode ?? "auto";
  const numSamples = params?.numSamples ?? DEFAULT_SAMPLES;
  const strengthWeight = params?.strengthWeight ?? STRENGTH_WEIGHT;
  const gameOverrides = params?.gameOverrides;
  const scenarioCount = missingGames.reduce((count, _, gameIndex) => {
    return count * (getOverrideOutcomeIndex(gameIndex, gameOverrides) === undefined ? 5 : 1);
  }, 1);

  if (mode === "exact" || (mode === "auto" && scenarioCount <= MAX_EXACT_SCENARIOS)) {
    const { playoffProbs, scenarioProbSum } = runExactPlayoffRace(strengthWeight, gameOverrides);
    const probabilities = {} as Record<TeamName, number>;
    for (const team of allTeams) {
      probabilities[team] = (playoffProbs[team] / scenarioProbSum) * 100;
    }

    return {
      modeUsed: "exact",
      denominator: scenarioProbSum,
      probabilities,
      scenarioCount
    };
  }

  const counts = simulatePlayoffRace(numSamples, strengthWeight, gameOverrides);
  const probabilities = {} as Record<TeamName, number>;
  for (const team of allTeams) {
    probabilities[team] = (counts[team] / numSamples) * 100;
  }

  return {
    modeUsed: "monte-carlo",
    denominator: numSamples,
    probabilities,
    scenarioCount
  };
}

export function getTeamsByProbability(probabilities: Record<TeamName, number>): Array<{ team: TeamName; probability: number }> {
  return [...allTeams]
    .map((team) => ({ team, probability: probabilities[team] }))
    .sort((a, b) => b.probability - a.probability);
}

export function getUpcomingGames(): Array<{ gameIndex: number; home: TeamName; away: TeamName }> {
  return missingGames
    .map(([home, away], gameIndex) => ({ gameIndex, home, away }))
    .sort((a, b) => {
      if (a.home !== b.home) {
        return a.home.localeCompare(b.home);
      }
      return a.away.localeCompare(b.away);
    });
}

export function getOutcomeOptionsForGame(gameIndex: number): Array<{ index: OutcomeIndex; label: string }> {
  const [team1, team2] = missingGames[gameIndex];
  return [
    { index: 0, label: `${team1} win in regulation` },
    { index: 1, label: `${team1} win in OT` },
    { index: 2, label: `${team2} win in OT` },
    { index: 3, label: `${team2} win in regulation` },
    { index: 4, label: "Draw 1-1" }
  ];
}

export function getCurrentStandings(): Array<{
  division: "DIVISION 1" | "DIVISION 2";
  rows: Array<{ team: TeamName; gp: number; points: number; ppg: number }>;
}> {
  const buildRows = (teams: readonly TeamName[]) =>
    [...teams]
      .map((team) => ({
        team,
        gp: gamesPlayedSoFar[team],
        points: currentPoints[team],
        ppg: currentPoints[team] / gamesPlayedSoFar[team]
      }))
      .sort((a, b) => b.ppg - a.ppg);

  return [
    { division: "DIVISION 1", rows: buildRows(division1) },
    { division: "DIVISION 2", rows: buildRows(division2) }
  ];
}

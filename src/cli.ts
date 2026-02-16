import { writeFileSync } from "node:fs";
import {
  DEFAULT_SAMPLES,
  getCurrentStandings,
  getTeamsByProbability,
  getUpcomingGames,
  runPlayoffProjection,
  type ProjectionMode
} from "./simulator";

type CliOptions = {
  mode: ProjectionMode;
  samples: number;
  outFile?: string;
  json: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: "auto",
    samples: DEFAULT_SAMPLES,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--mode") {
      const value = argv[i + 1] as ProjectionMode | undefined;
      if (value === "auto" || value === "exact" || value === "monte-carlo") {
        options.mode = value;
        i += 1;
        continue;
      }
      throw new Error("--mode must be one of: auto | exact | monte-carlo");
    }

    if (arg === "--samples") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--samples must be a positive number");
      }
      options.samples = Math.floor(value);
      i += 1;
      continue;
    }

    if (arg === "--out") {
      options.outFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp(): void {
  console.log("EHL Playoff Projection CLI");
  console.log("");
  console.log("Usage:");
  console.log("  bun run src/cli.ts [--mode auto|exact|monte-carlo] [--samples N] [--json] [--out file]");
}

function printStandings(): void {
  console.log("\nCURRENT STANDINGS");
  for (const section of getCurrentStandings()) {
    console.log(`\n${section.division}`);
    console.log(`${"Team".padEnd(26)} ${"GP".padStart(3)} ${"Pts".padStart(5)} ${"PPG".padStart(6)}`);
    for (const row of section.rows) {
      console.log(
        `${row.team.padEnd(26)} ${String(row.gp).padStart(3)} ${String(row.points).padStart(5)} ${row.ppg.toFixed(2).padStart(6)}`
      );
    }
  }
}

function printUpcomingGames(): void {
  console.log("\nUPCOMING GAMES");
  const games = getUpcomingGames();
  games.forEach((game, index) => {
    console.log(`${String(index + 1).padStart(2)}. ${game.home} vs ${game.away}`);
  });
}

function run(): void {
  const args = parseArgs(process.argv.slice(2));
  const projection = runPlayoffProjection({ mode: args.mode, numSamples: args.samples });
  const sorted = getTeamsByProbability(projection.probabilities);

  const payload = {
    generatedAt: new Date().toISOString(),
    modeUsed: projection.modeUsed,
    denominator: projection.denominator,
    scenarioCount: projection.scenarioCount,
    teams: sorted
  };

  if (args.json) {
    const json = JSON.stringify(payload, null, 2);
    if (args.outFile) {
      writeFileSync(args.outFile, `${json}\n`, "utf8");
      console.log(`Saved JSON projection to ${args.outFile}`);
      return;
    }
    console.log(json);
    return;
  }

  printStandings();
  printUpcomingGames();

  console.log(`\nMode used: ${projection.modeUsed}`);
  if (projection.modeUsed === "exact") {
    console.log(`Scenario mass checked: ${projection.denominator.toFixed(6)}`);
  } else {
    console.log(`Samples: ${projection.denominator.toLocaleString()}`);
  }

  console.log("\nPLAYOFF CHANCES");
  for (const row of sorted) {
    console.log(`${row.team.padEnd(26)} ${row.probability.toFixed(2).padStart(7)}%`);
  }

  if (args.outFile) {
    writeFileSync(args.outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`\nSaved JSON projection to ${args.outFile}`);
  }
}

run();

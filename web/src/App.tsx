import { useMemo, useState, type CSSProperties } from "react";
import {
  DEFAULT_SAMPLES,
  getTeamsByProbability,
  getUpcomingGames,
  runPlayoffProjection,
  type GameOverrides,
  type OutcomeIndex,
  type ProjectionMode
} from "@simulator";

const games = getUpcomingGames();
const sliderToOutcome = [0, 1, 4, 2, 3] as const;
const outcomeToSlider: Record<OutcomeIndex, number> = { 0: 0, 1: 1, 2: 3, 3: 4, 4: 2 };

type ProjectionInputs = {
  mode: ProjectionMode;
  samples: number;
  strengthWeight: number;
  overrides: GameOverrides;
};

function formatLargeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString();
}

function serializeOverrides(overrides: GameOverrides): string {
  return Object.entries(overrides)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([gameIndex, outcome]) => `${gameIndex}:${String(outcome)}`)
    .join("|");
}

export function App() {
  const initialInputs: ProjectionInputs = {
    mode: "auto",
    samples: Math.min(DEFAULT_SAMPLES, 150_000),
    strengthWeight: 0.9,
    overrides: {}
  };

  const [draftInputs, setDraftInputs] = useState<ProjectionInputs>(initialInputs);
  const [appliedInputs, setAppliedInputs] = useState<ProjectionInputs>(initialInputs);

  const hasPendingChanges =
    draftInputs.mode !== appliedInputs.mode ||
    draftInputs.samples !== appliedInputs.samples ||
    draftInputs.strengthWeight !== appliedInputs.strengthWeight ||
    serializeOverrides(draftInputs.overrides) !== serializeOverrides(appliedInputs.overrides);

  const projection = useMemo(
    () =>
      runPlayoffProjection({
        mode: appliedInputs.mode,
        numSamples: appliedInputs.samples,
        strengthWeight: appliedInputs.strengthWeight,
        gameOverrides: appliedInputs.overrides
      }),
    [appliedInputs]
  );
  const rows = useMemo(() => getTeamsByProbability(projection.probabilities), [projection.probabilities]);

  const handleOverrideChange = (index: number, value: OutcomeIndex | undefined) => {
    setDraftInputs((prev) => {
      const nextOverrides = { ...prev.overrides };
      if (value === undefined) {
        delete nextOverrides[index];
        return { ...prev, overrides: nextOverrides };
      }
      nextOverrides[index] = value;
      return { ...prev, overrides: nextOverrides };
    });
  };

  const activeDraftOverrideCount = Object.keys(draftInputs.overrides).length;
  const activeAppliedOverrideCount = Object.keys(appliedInputs.overrides).length;

  return (
    <div className="shell">
      <div className="workspace">
        <aside className="card overrides-panel">
          <div className="overrides-panel-head">
            <h2>Game Result Overrides</h2>
            <p className="small">Team - slider - team layout for quick scenario input.</p>
            <p className="small">Left = first team win side, center = draw, right = second team win side.</p>
            <button
              type="button"
              onClick={() => setDraftInputs((prev) => ({ ...prev, overrides: {} }))}
              className="ghost-button"
            >
              Reset draft overrides ({activeDraftOverrideCount})
            </button>
          </div>

          <div className="overrides-list">
            {games.map((game, index) => {
              const value = draftInputs.overrides[game.gameIndex];
              const sliderValue = value === undefined ? 2 : outcomeToSlider[value];

              return (
                <div className={`override-row ${value === undefined ? "auto" : ""}`} key={`${game.home}-${game.away}-${game.gameIndex}`}>
                  <span className="slider-team slider-team-left">
                    {index + 1}. {game.home}
                  </span>

                  <input
                    className="match-slider"
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={sliderValue}
                    onChange={(event) =>
                      handleOverrideChange(game.gameIndex, sliderToOutcome[Number(event.target.value)] as OutcomeIndex)
                    }
                    aria-label={`Outcome override for ${game.home} versus ${game.away}`}
                  />

                  <span className="slider-team slider-team-right">{game.away}</span>

                  <button
                    type="button"
                    className="mini-ghost mini-inline"
                    onClick={() => handleOverrideChange(game.gameIndex, undefined)}
                    disabled={value === undefined}
                  >
                    Auto
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="main-column">
          <header className="hero">
            <p className="kicker">EHL projection lab</p>
            <h1>Interactive Playoff Simulator</h1>
            <p className="subtitle">
              Tune simulation depth, strength impact, and force outcomes for upcoming games. The same core TypeScript
              simulator powers both this UI and the Bun CLI.
            </p>
          </header>

          <section className="card results">
            <h2>Playoff Chances</h2>

            <div className="meta">
              <span className="chip">mode: {projection.modeUsed}</span>
              <span className="chip">scenario count: {formatLargeNumber(projection.scenarioCount)}</span>
              <span className="chip">applied overrides: {activeAppliedOverrideCount}</span>
              <span className="chip">
                {projection.modeUsed === "exact"
                  ? `probability mass: ${projection.denominator.toFixed(6)}`
                  : `samples: ${formatLargeNumber(projection.denominator)}`}
              </span>
            </div>

            <div className="team-list">
              {rows.map((row, index) => (
                <div
                  className={`team-row ${index < 8 ? "top-cut" : ""}`}
                  key={row.team}
                  style={{ "--prob": `${Math.max(2, row.probability)}%` } as CSSProperties}
                >
                  <span>{row.team}</span>
                  <strong>{row.probability.toFixed(2)}%</strong>
                </div>
              ))}
            </div>
          </section>
        </main>

        <section className="card controls controls-panel">
          <h2>Projection Controls</h2>

          <div className="field">
            <label htmlFor="mode">Mode</label>
            <select
              id="mode"
              value={draftInputs.mode}
              onChange={(event) => setDraftInputs((prev) => ({ ...prev, mode: event.target.value as ProjectionMode }))}
            >
              <option value="auto">auto</option>
              <option value="exact">exact</option>
              <option value="monte-carlo">monte-carlo</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="samples">Monte Carlo samples</label>
            <input
              id="samples"
              type="number"
              min={1000}
              step={1000}
              value={draftInputs.samples}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next > 0) {
                  setDraftInputs((prev) => ({ ...prev, samples: Math.floor(next) }));
                }
              }}
            />
            <p className="small">Used only in monte-carlo mode or when auto selects monte-carlo.</p>
          </div>

          <div className="field">
            <label htmlFor="weight">Strength weight</label>
            <div className="range-row">
              <input
                id="weight"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={draftInputs.strengthWeight}
                onChange={(event) => setDraftInputs((prev) => ({ ...prev, strengthWeight: Number(event.target.value) }))}
              />
              <output>{draftInputs.strengthWeight.toFixed(2)}</output>
            </div>
            <p className="small">0.00 = coin-flip games, 1.00 = full strength-weighted outcomes.</p>
          </div>

          <div className="actions-row">
            <button type="button" disabled={!hasPendingChanges} onClick={() => setAppliedInputs(draftInputs)}>
              Apply changes
            </button>
            <button className="ghost-button" type="button" onClick={() => setDraftInputs(appliedInputs)}>
              Revert edits
            </button>
          </div>

          <p className="small">{hasPendingChanges ? "You have unapplied edits." : "All changes are applied."}</p>
        </section>

      </div>
    </div>
  );
}

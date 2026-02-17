import { useMemo, useRef, useState, type CSSProperties } from "react";
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

type MobilePanel = "controls" | "overrides" | null;
type TeamFilter = "all" | (typeof games)[number]["home"];

function formatLargeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString();
}

function formatModeLabel(mode: ProjectionMode): string {
  if (mode === "monte-carlo") {
    return "Monte Carlo";
  }
  if (mode === "exact") {
    return "Exact";
  }
  return "Auto";
}

function serializeOverrides(overrides: GameOverrides): string {
  return Object.entries(overrides)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([gameIndex, outcome]) => `${gameIndex}:${String(outcome)}`)
    .join("|");
}

function formatOverrideLabel(team1: string, team2: string, outcome: OutcomeIndex | undefined): string {
  if (outcome === undefined) {
    return "Auto (simulated)";
  }

  if (outcome === 0) {
    return `${team1} win (regulation)`;
  }
  if (outcome === 1) {
    return `${team1} win (OT)`;
  }
  if (outcome === 2) {
    return `${team2} win (OT)`;
  }
  if (outcome === 3) {
    return `${team2} win (regulation)`;
  }
  return "Draw";
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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const controlsPanelRef = useRef<HTMLElement | null>(null);
  const overridesPanelRef = useRef<HTMLElement | null>(null);

  const teamOptions = useMemo(
    () => [...new Set(games.flatMap((game) => [game.home, game.away]))].sort((a, b) => a.localeCompare(b)),
    []
  );

  const filteredGames = useMemo(() => {
    if (teamFilter === "all") {
      return games;
    }
    return games.filter((game) => game.home === teamFilter || game.away === teamFilter);
  }, [teamFilter]);

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
  const visibleRows = useMemo(() => rows.filter((row) => row.probability >= 0.005), [rows]);

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

  const toggleMobilePanel = (panel: Exclude<MobilePanel, null>) => {
    setMobilePanel((prev) => {
      const next = prev === panel ? null : panel;

      if (next !== null) {
        requestAnimationFrame(() => {
          const target = next === "controls" ? controlsPanelRef.current : overridesPanelRef.current;
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      return next;
    });
  };

  const activeDraftOverrideCount = Object.keys(draftInputs.overrides).length;
  const activeAppliedOverrideCount = Object.keys(appliedInputs.overrides).length;

  return (
    <div className="shell">
      <div className="background-layer" aria-hidden="true" />
      <div className="grain-layer" aria-hidden="true" />
      <div className="workspace">
        <main className="main-column">
          <section className="card results">
            <h2>Playoff Chances</h2>

            <div className="quick-actions">
              <span className="small">Quick mode buttons update the draft instantly.</span>
              <div className="quick-action-row" role="group" aria-label="Quick mode changes">
                <button
                  type="button"
                  className={`mini-ghost quick-action ${draftInputs.mode === "auto" ? "is-active" : ""}`}
                  onClick={() => setDraftInputs((prev) => ({ ...prev, mode: "auto" }))}
                >
                  Auto mode
                </button>
                <button
                  type="button"
                  className={`mini-ghost quick-action ${draftInputs.mode === "exact" ? "is-active" : ""}`}
                  onClick={() => setDraftInputs((prev) => ({ ...prev, mode: "exact" }))}
                >
                  Exact mode
                </button>
                <button
                  type="button"
                  className={`mini-ghost quick-action ${draftInputs.mode === "monte-carlo" ? "is-active" : ""}`}
                  onClick={() => setDraftInputs((prev) => ({ ...prev, mode: "monte-carlo" }))}
                >
                  Monte Carlo mode
                </button>
                <button
                  type="button"
                  className="mini-ghost quick-action"
                  disabled={activeDraftOverrideCount === 0}
                  onClick={() => setDraftInputs((prev) => ({ ...prev, overrides: {} }))}
                >
                  Clear draft overrides
                </button>
              </div>
            </div>

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
              {visibleRows.map((row, index) => (
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

          <header className="hero">
            <p className="kicker">EHL projection lab</p>
            <h1>Interactive Playoff Simulator</h1>
            <p className="subtitle">
              Tune simulation depth, strength impact, and force outcomes for upcoming games. The same core TypeScript
              simulator powers both this UI and the Bun CLI.
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <span>Mode in use</span>
                <strong>{formatModeLabel(projection.modeUsed)}</strong>
              </div>
              <div className="hero-stat">
                <span>Active overrides</span>
                <strong>{activeAppliedOverrideCount}</strong>
              </div>
              <div className="hero-stat">
                <span>Scenario volume</span>
                <strong>{formatLargeNumber(projection.scenarioCount)}</strong>
              </div>
            </div>

            <div className="mobile-panel-buttons" role="group" aria-label="Open mobile editor panels">
              <button
                type="button"
                className={`ghost-button ${mobilePanel === "controls" ? "is-active" : ""}`}
                onClick={() => toggleMobilePanel("controls")}
                aria-expanded={mobilePanel === "controls"}
                aria-controls="projection-controls-panel"
              >
                Projection controls
              </button>

              <button
                type="button"
                className={`ghost-button ${mobilePanel === "overrides" ? "is-active" : ""}`}
                onClick={() => toggleMobilePanel("overrides")}
                aria-expanded={mobilePanel === "overrides"}
                aria-controls="game-overrides-panel"
              >
                Game overrides ({activeDraftOverrideCount})
              </button>
            </div>

            <div className="mobile-draft-actions">
              <button type="button" disabled={!hasPendingChanges} onClick={() => setAppliedInputs(draftInputs)}>
                Apply pending changes
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={!hasPendingChanges}
                onClick={() => setDraftInputs(appliedInputs)}
              >
                Revert draft
              </button>
            </div>
          </header>
        </main>

        <section
          className={`card controls controls-panel mobile-edit-panel ${mobilePanel === "controls" ? "mobile-open" : ""}`}
          id="projection-controls-panel"
          ref={controlsPanelRef}
        >
          <div className="panel-title-row">
            <div>
              <p className="panel-kicker">Simulation Inputs</p>
              <h2>Projection Controls</h2>
            </div>
            <button type="button" className="mini-ghost mobile-close" onClick={() => setMobilePanel(null)}>
              Close
            </button>
          </div>

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

        <aside
          className={`card overrides-panel mobile-edit-panel ${mobilePanel === "overrides" ? "mobile-open" : ""}`}
          id="game-overrides-panel"
          ref={overridesPanelRef}
        >
          <div className="overrides-panel-head">
            <div className="panel-title-row">
              <div>
                <p className="panel-kicker">Scenario Setup</p>
                <h2>Game Result Overrides</h2>
              </div>
              <button type="button" className="mini-ghost mobile-close" onClick={() => setMobilePanel(null)}>
                Close
              </button>
            </div>
            <p className="small">Team - slider - team layout for quick scenario input.</p>
            <p className="small">Left = first listed team win outcomes, center = draw, right = second team win outcomes.</p>
            <p className="small overrides-legend">Scale: Left team reg | Left team OT | Draw | Right team OT | Right team reg</p>

            <div className="team-filter-row">
              <label htmlFor="team-filter">Filter by team</label>
              <div className="team-filter-controls">
                <select
                  id="team-filter"
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value as TeamFilter)}
                >
                  <option value="all">All teams</option>
                  {teamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mini-ghost"
                  disabled={teamFilter === "all"}
                  onClick={() => setTeamFilter("all")}
                >
                  Clear
                </button>
              </div>
              <p className="small">{filteredGames.length} games shown</p>
            </div>

            <button
              type="button"
              onClick={() => setDraftInputs((prev) => ({ ...prev, overrides: {} }))}
              className="ghost-button"
            >
              Reset draft overrides ({activeDraftOverrideCount})
            </button>
          </div>

          <div className="overrides-list">
            {filteredGames.length === 0 && (
              <p className="small empty-overrides">No upcoming games match this team filter.</p>
            )}

            {filteredGames.map((game, index) => {
              const value = draftInputs.overrides[game.gameIndex];
              const sliderValue = value === undefined ? 2 : outcomeToSlider[value];
              const overrideLabel = formatOverrideLabel(game.home, game.away, value);

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
                    aria-valuetext={overrideLabel}
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

                  <span className={`override-status ${value === undefined ? "auto" : "manual"}`}>{overrideLabel}</span>
                </div>
              );
            })}
          </div>
        </aside>

      </div>
    </div>
  );
}

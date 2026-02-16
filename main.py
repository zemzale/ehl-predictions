import random
import matplotlib.pyplot as plt
import seaborn as sns
import datetime
from collections import Counter
from itertools import product

# Set style
sns.set_style("whitegrid")

# How much standings strength affects win probability.
# 0.0 = pure coin flip, 1.0 = full strength-based probability.
STRENGTH_WEIGHT = 0.9
N_SAMPLES = 1_000_000
MAX_EXACT_SCENARIOS = 2_000_000

# ============ TEAMS & DIVISIONS ============
division_1 = [
    "RŪRE", "PRODUS/BLACK MAGIC", "TUKUMA BRĀĻI II", "SPARTA RB",
    "3S", "TAURUS", "LIELUPE"
]

division_2 = [
    "MARELS BOVE II", "MEŽABRĀĻI", "PILSETAS LEĢENDAS E4", "ICE WOLVES E4",
    "PTA", "SANTEKO", "RUPUČI II", "ARTA ABOLI"
]

# Flattened list for lookups
all_teams = division_1 + division_2

current_points = {
    "RŪRE": 34,
    "PRODUS/BLACK MAGIC": 32,
    "TUKUMA BRĀĻI II": 35,
    "SPARTA RB": 29,
    "3S": 28,
    "TAURUS": 27,
    "LIELUPE": 16,
    "MARELS BOVE II": 44,
    "MEŽABRĀĻI": 40,
    "PILSETAS LEĢENDAS E4": 20,
    "ICE WOLVES E4": 28,
    "PTA": 18,
    "SANTEKO": 20,
    "RUPUČI II": 21,
    "ARTA ABOLI": 6
}

games_played_so_far = {
    "RŪRE": 17,
    "PRODUS/BLACK MAGIC": 18,
    "TUKUMA BRĀĻI II": 18,
    "SPARTA RB": 19,
    "3S": 18,
    "TAURUS": 18,
    "LIELUPE": 19,
    "MARELS BOVE II": 19,
    "MEŽABRĀĻI": 20,
    "PILSETAS LEĢENDAS E4": 18,
    "ICE WOLVES E4": 19,
    "PTA": 21,
    "SANTEKO": 18,
    "RUPUČI II": 17,
    "ARTA ABOLI": 19,
}

# Missing games based on the provided table (blank cells)
missing_games = [
    ("MARELS BOVE II", "RŪRE"),
    ("MARELS BOVE II", "3S"),

    ("ICE WOLVES E4", "PRODUS/BLACK MAGIC"),

    ("PILSETAS LEĢENDAS E4", "TUKUMA BRĀĻI II"),
    ("PILSETAS LEĢENDAS E4", "SPARTA RB"),
    ("PILSETAS LEĢENDAS E4", "LIELUPE"),

    ("RUPUČI II", "RŪRE"),
    ("RUPUČI II", "3S"),
    ("RUPUČI II", "TAURUS"),
    ("RUPUČI II", "MEŽABRĀĻI"),

    ("SANTEKO", "RŪRE"),
    ("SANTEKO", "PRODUS/BLACK MAGIC"),
    ("SANTEKO", "TAURUS"),

    ("ARTA ABOLI", "TUKUMA BRĀĻI II"),
    ("ARTA ABOLI", "ICE WOLVES E4"),

    ("3S", "TAURUS"),
    ("RŪRE", "SPARTA RB"),
    ("TUKUMA BRĀĻI II", "PRODUS/BLACK MAGIC"),
]


# ============ PRE-CALCULATION ============
# Calculate total games scheduled per team for PPG normalization
total_scheduled_games = games_played_so_far.copy()
for t1, t2 in missing_games:
    total_scheduled_games[t1] += 1
    total_scheduled_games[t2] += 1

def calculate_team_strength():
    team_strength = {}
    for team, pts in current_points.items():
        gp = games_played_so_far.get(team, 1)
        team_strength[team] = pts / gp if gp > 0 else 0.5
    return team_strength

def get_game_outcomes(team1, team2, team_strength):
    s1 = team_strength.get(team1, 1.0)
    s2 = team_strength.get(team2, 1.0)
    total = s1 + s2
    raw_p1 = s1 / total if total > 0 else 0.5
    p1 = 0.5 + ((raw_p1 - 0.5) * STRENGTH_WEIGHT)

    t1 = p1 * 0.55
    t2 = p1 * 0.75
    t3 = t2 + ((1 - p1) * 0.4)

    return [
        (3, 0, t1),
        (2, 1, t2 - t1),
        (1, 2, t3 - t2),
        (0, 3, 0.90 - t3),
        (1, 1, 0.10),
    ]

def get_qualifiers(points):
    def get_ppg(t_name):
        return points[t_name] / total_scheduled_games[t_name]

    d1_standings = sorted(division_1, key=get_ppg, reverse=True)
    d2_standings = sorted(division_2, key=get_ppg, reverse=True)

    qualifiers = []
    qualifiers.extend(d1_standings[:3])
    qualifiers.extend(d2_standings[:3])

    leftovers = d1_standings[3:] + d2_standings[3:]
    leftovers_sorted = sorted(leftovers, key=get_ppg, reverse=True)
    qualifiers.extend(leftovers_sorted[:2])
    return qualifiers

def simulate_playoff_race(num_samples=10000):
    playoff_counts = Counter()
    team_strength = calculate_team_strength()
    game_outcomes = [get_game_outcomes(t1, t2, team_strength) for t1, t2 in missing_games]

    for _ in range(num_samples):
        points = current_points.copy()

        for game_index, (team1, team2) in enumerate(missing_games):
            rand = random.random()
            cumulative = 0.0
            selected = game_outcomes[game_index][-1]
            for outcome in game_outcomes[game_index]:
                cumulative += outcome[2]
                if rand <= cumulative:
                    selected = outcome
                    break

            points[team1] += selected[0]
            points[team2] += selected[1]

        qualifiers = get_qualifiers(points)
        for q in qualifiers:
            playoff_counts[q] += 1

    return playoff_counts

def run_exact_playoff_race():
    playoff_probs = {team: 0.0 for team in all_teams}
    team_strength = calculate_team_strength()
    game_outcomes = [get_game_outcomes(t1, t2, team_strength) for t1, t2 in missing_games]

    scenario_prob_sum = 0.0
    outcome_index_range = [range(5) for _ in missing_games]

    for scenario in product(*outcome_index_range):
        points = current_points.copy()
        scenario_prob = 1.0

        for game_index, outcome_index in enumerate(scenario):
            team1, team2 = missing_games[game_index]
            p1_delta, p2_delta, outcome_prob = game_outcomes[game_index][outcome_index]
            points[team1] += p1_delta
            points[team2] += p2_delta
            scenario_prob *= outcome_prob

        if scenario_prob == 0.0:
            continue

        qualifiers = get_qualifiers(points)
        for q in qualifiers:
            playoff_probs[q] += scenario_prob

        scenario_prob_sum += scenario_prob

    return playoff_probs, scenario_prob_sum

def run_playoff_projection(mode="auto", num_samples=10000):
    scenario_count = 5 ** len(missing_games)

    if mode == "exact" or (mode == "auto" and scenario_count <= MAX_EXACT_SCENARIOS):
        print(f"Running exact mode across {scenario_count:,} scenarios...")
        counts, total_weight = run_exact_playoff_race()
        print(f"Exact mode complete. Probability mass checked: {total_weight:.6f}")
        return counts, total_weight, "exact"

    print(f"Running Monte Carlo mode with {num_samples:,} samples...")
    counts = simulate_playoff_race(num_samples)
    return counts, float(num_samples), "monte-carlo"

def print_upcoming_games():
    print("\n" + "="*60)
    print("UPCOMING GAMES (FROM MISSING LIST)")
    print("="*60)

    sorted_games = sorted(missing_games, key=lambda g: (g[0], g[1]))
    for idx, (home, away) in enumerate(sorted_games, start=1):
        print(f"{idx:>2}. {home} vs {away}")

    print("="*60 + "\n")

def viz_playoff_chances(filename, counts, total_sims):
    # Sort teams by probability
    sorted_teams = sorted(counts.keys(), key=lambda x: counts[x], reverse=True)
    probs = [counts[t] / total_sims * 100 for t in sorted_teams]
    
    plt.figure(figsize=(12, 10))
    
    # Color coding bars based on division
    bar_colors = []
    for t in sorted_teams:
        if t in division_1: bar_colors.append('#1f77b4') # Blue for Div 1
        else: bar_colors.append('#ff7f0e') # Orange for Div 2
        
    bars = plt.barh(sorted_teams, probs, color=bar_colors, edgecolor='black', alpha=0.8)
    
    plt.xlabel('Probability of Making Playoffs (%)', fontsize=12, fontweight='bold')
    plt.title('Playoff Qualification Chances\n(Top 3 per Div + 2 Wildcards)', fontsize=14, fontweight='bold')
    plt.xlim(0, 105)
    
    # Legend
    from matplotlib.patches import Patch
    legend_elements = [Patch(facecolor='#1f77b4', edgecolor='black', label='Division 1'),
                       Patch(facecolor='#ff7f0e', edgecolor='black', label='Division 2')]
    plt.legend(handles=legend_elements, loc='lower right')
    
    # Add text labels
    for i, (bar, prob) in enumerate(zip(bars, probs)):
        fw = 'bold' if prob > 50 else 'normal'
        plt.text(prob + 1, i, f'{prob:.1f}%', va='center', fontweight=fw, fontsize=10)
    
    plt.gca().invert_yaxis() # Highest probability at top
    plt.tight_layout()
    plt.savefig(filename, dpi=150)
    plt.show()

def print_points_table():
    print("\n" + "="*60)
    print("CURRENT STANDINGS")
    print("="*60)
    
    for div_name, teams in [("DIVISION 1", division_1), ("DIVISION 2", division_2)]:
        print(f"\n{div_name}")
        print("-"*60)
        standings = sorted(teams, key=lambda t: current_points[t] / games_played_so_far[t], reverse=True)
        print(f"{'Team':<30} {'GP':>4} {'Pts':>5} {'PPG':>6}")
        print("-"*60)
        for team in standings:
            gp = games_played_so_far[team]
            pts = current_points[team]
            ppg = pts / gp
            print(f"{team:<30} {gp:>4} {pts:>5} {ppg:>6.2f}")
    print("="*60 + "\n")

if __name__ == "__main__":
    print(f"Teams in Div 1: {len(division_1)}")
    print(f"Teams in Div 2: {len(division_2)}")
    
    print_points_table()
    print_upcoming_games()
    
    results, denominator, mode_used = run_playoff_projection(mode="auto", num_samples=N_SAMPLES)
    
    print("Generating Graph...")

    run_label = f"{mode_used}_{int(denominator)}"
    filename = f"playoff_chances_{run_label}_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.png"

    viz_playoff_chances(filename, results, denominator)

    print(f"Done. Saved to '{filename}'")

import random
import matplotlib.pyplot as plt
import seaborn as sns
import datetime
from collections import Counter

# Set style
sns.set_style("whitegrid")

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
    "RŪRE": 28,
    "PRODUS/BLACK MAGIC": 22,
    "TUKUMA BRĀĻI II": 24,
    "SPARTA RB": 18,
    "3S": 20,
    "TAURUS": 20,
    "LIELUPE": 9,
    "MARELS BOVE II": 31,
    "MEŽABRĀĻI": 29,
    "PILSETAS LEĢENDAS E4": 19,
    "ICE WOLVES E4": 19,
    "PTA": 16,
    "SANTEKO": 16,
    "RUPUČI II": 13,
    "ARTA ABOLI": 5
}

games_played_so_far = {
    "RŪRE": 14,
    "PRODUS/BLACK MAGIC": 13,
    "TUKUMA BRĀĻI II": 13,
    "SPARTA RB": 13,
    "3S": 13,
    "TAURUS": 14,
    "LIELUPE": 15,
    "MARELS BOVE II": 14,
    "MEŽABRĀĻI": 13,
    "PILSETAS LEĢENDAS E4": 14,
    "ICE WOLVES E4": 14,
    "PTA": 16,
    "SANTEKO": 12,
    "RUPUČI II": 10,
    "ARTA ABOLI": 14,
}

# Known missing games (Intra-division based on your list)
missing_games = [
    #("TUKUMA BRĀĻI II", "SPARTA RB"),
    #("PRODUS/BLACK MAGIC", "TAURUS"),
    #("MARELS BOVE II", "MEŽABRĀĻI"),
    #("MARELS BOVE II", "PTA"),
    ("PTA", "MEŽABRĀĻI"),
    ("RUPUČI II", "MEŽABRĀĻI"),
    ("RUPUČI II", "PILSETAS LEĢENDAS E4"),
    ("RUPUČI II", "ICE WOLVES E4"),
    ("RUPUČI II", "SANTEKO"),
    ("ARTA ABOLI", "ICE WOLVES E4"),
    ("ARTA ABOLI", "SANTEKO"),
    #("RUPUČI II", "ARTA ABOLI"),
]

# ============ EXTEND SCHEDULE LOGIC ============
def generate_inter_division_games():
    """Generates one game between every Div 1 team and every Div 2 team"""
    new_games = []
    for d1_team in division_1:
        for d2_team in division_2:
            if d1_team == "RŪRE" and d2_team == "PILSETAS LEĢENDAS E4":
                if d2_team in ["PILSETAS LEĢENDAS E4", "ARTA ABOLI"]:
                    continue
            if d1_team == "TUKUMA BRĀĻI II" and d2_team == "ICE WOLVES E4":
                continue
            if d1_team == "3S":
                if d2_team in ["PTA"]:
                    continue
            if d1_team == "PRODUS/BLACK MAGIC" and d2_team == "RUPUČI II":
                continue
            if d1_team == "TAURUS":
                if d2_team in ["PTA", "ARTA ABOLI"]:
                    continue
            if d1_team == "SPARTA RB":
                if d2_team in ["MEŽABRĀĻI"]:
                    continue
            if d1_team == "LIELUPE":
                if d2_team in ["PTA", "ICE WOLVES E4", "PTA"]:
                    continue
            new_games.append((d1_team, d2_team))
    return new_games

# WARNING: Only uncomment this if teams strictly haven't played these matchups yet.
# If they have played some, this will double-count them.
missing_games.extend(generate_inter_division_games()) 


# ============ PRE-CALCULATION ============
# Calculate total games scheduled per team for PPG normalization
total_scheduled_games = games_played_so_far.copy()
for t1, t2 in missing_games:
    total_scheduled_games[t1] += 1
    total_scheduled_games[t2] += 1

def simulate_playoff_race(num_samples=10000):
    playoff_counts = Counter()
    
    # Calculate Strength based on PPG
    team_strength = {}
    for team, pts in current_points.items():
        gp = games_played_so_far.get(team, 1)
        team_strength[team] = pts / gp if gp > 0 else 0.5
    
    for _ in range(num_samples):
        points = current_points.copy()
        
        # 1. Sim Games
        for team1, team2 in missing_games:
            s1 = team_strength.get(team1, 1.0)
            s2 = team_strength.get(team2, 1.0)
            total = s1 + s2
            p1 = s1 / total if total > 0 else 0.5
            
            rand = random.random()
            
            if rand < p1 * 0.55: points[team1] += 3
            elif rand < p1 * 0.75: 
                points[team1] += 2; points[team2] += 1
            elif rand < p1 * 0.75 + ((1-p1) * 0.4): 
                points[team1] += 1; points[team2] += 2
            elif rand < 0.90: points[team2] += 3
            else: 
                points[team1] += 1; points[team2] += 1

        # 2. PPG Calculation Helper
        def get_ppg(t_name):
            return points[t_name] / total_scheduled_games[t_name]

        # 3. Division Logic
        # Sort Div 1 by PPG
        d1_standings = sorted(division_1, key=get_ppg, reverse=True)
        # Sort Div 2 by PPG
        d2_standings = sorted(division_2, key=get_ppg, reverse=True)
        
        # 4. Determine Qualifiers
        qualifiers = []
        
        # Rule A: Top 3 from each division
        qualifiers.extend(d1_standings[:3])
        qualifiers.extend(d2_standings[:3])
        
        # Rule B: 2 Top teams from ALL leftovers (Wildcard)
        leftovers = d1_standings[3:] + d2_standings[3:]
        leftovers_sorted = sorted(leftovers, key=get_ppg, reverse=True)
        
        qualifiers.extend(leftovers_sorted[:2])
        
        # 5. Record Results
        for q in qualifiers:
            playoff_counts[q] += 1
            
    return playoff_counts

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
    N_SAMPLES = 50000 
    print(f"Teams in Div 1: {len(division_1)}")
    print(f"Teams in Div 2: {len(division_2)}")
    
    print_points_table()
    
    print(f"Simulating {N_SAMPLES} seasons...")
    results = simulate_playoff_race(N_SAMPLES)
    
    print("Generating Graph...")

    filename = f"playoff_chances_{N_SAMPLES}_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.png"

    viz_playoff_chances(filename, results, N_SAMPLES)

    print(f"Done. Saved to '{filename}'")


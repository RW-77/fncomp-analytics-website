"""Extract one real fight for the event-grouping animation.

Reads a processed match straight from S3 (timeline metadata, movement chunks,
shots and engagements) and writes remotion/public/fight.json, which the
composition loads with staticFile(): every player alive in the window with
positions sampled at SAMPLE_HZ, the shots fired, and the engagement itself
(as the website's EngagementDetails reads it).

Positions are metres relative to the engagement's centroid, rounded to 0.1 m
to keep the file small. Axes are as the replay draws them on a BR map: x east,
y down the screen; yaw is degrees clockwise from east.

Run with any Python that has boto3 and numpy (the ETL's environment works):

    python remotion/data/extract_fight.py                      # fight #23 -> public/fight.json
    python remotion/data/extract_fight.py <match id> <fight #>  # -> public/fights/<match 8>-<fight #>.json

A fight's number is the one the site shows (its engagement id + 1). For a new
fight the window runs from 15 s before it to 12 s after it.
"""

import argparse
import io
import json
from pathlib import Path

import boto3
import numpy as np

BUCKET = "fortnite-tournament-objects"
MATCH_ID = "7afaa001527de00e9422e88104ffdbb6"   # PE Finals 6 NAC, Match 2
ENGAGEMENT_ID = 22                              # #23: zone 5, three teams, a third party joins
WINDOW_S = (762.0, 845.0)                       # game seconds: a lead-in, the fight, a tail
SAMPLE_HZ = 10

X, Y, Z, YAW, HP, SHIELD, ALIVE, KNOCKED = range(8)

s3 = boto3.client("s3")
PUBLIC = Path(__file__).parent.parent / "public"


def main() -> None:
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument("match", nargs="?", help="match id (default: fight #23's)")
    args.add_argument("number", nargs="?", type=int, help="fight number, as the site shows it")
    a = args.parse_args()
    if a.match:
        extract(a.match, a.number - 1, None, PUBLIC / "fights" / f"{a.match[:8]}-{a.number}.json")
    else:
        extract(MATCH_ID, ENGAGEMENT_ID, WINDOW_S, PUBLIC / "fight.json")


def extract(match_id: str, engagement_id: int, window_s: tuple[float, float] | None, path: Path) -> None:
    def get(key: str) -> bytes:
        return s3.get_object(Bucket=BUCKET, Key=f"replays/matches/{match_id}/{key}")["Body"].read()

    meta = json.loads(get("metadata.json"))
    fights = json.loads(get("engagements.json"))["engagements"]
    fight = next(f for f in fights if f["id"] == engagement_id)
    shots = json.loads(get("shots.json"))
    if window_s is None:
        window_s = (max(0.0, round(fight["start_s"] - 15)), round(fight["end_s"] + 12))

    hz, interval = meta["hz"], meta["interval_seconds"]
    per_chunk = hz * interval
    first, last = int(window_s[0] * hz), int(window_s[1] * hz)
    frames = []
    for chunk in range(first // per_chunk, last // per_chunk + 1):
        data = np.load(io.BytesIO(get(f"movement/{chunk:05d}.npy")))
        frames.append(data)
    movement = np.concatenate(frames)
    offset = (first // per_chunk) * per_chunk
    step = hz // SAMPLE_HZ
    window = movement[first - offset:last - offset:step]          # [samples, players, 8]

    cx, cy = fight["centroid"][0], fight["centroid"][1]
    index_to_player = meta.get("index_to_player") or {str(i): p for p, i in meta["player_to_index"].items()}
    names, teams = meta["id_to_username"], meta["index_to_team"]

    players = []
    for index in range(window.shape[1]):
        alive = window[:, index, ALIVE] > 0.5
        if not alive.any():
            continue                                               # dead before the window
        pid = index_to_player[str(index)]
        players.append({
            "id": pid,
            "name": names.get(pid, pid[:8]),
            "team": teams.get(str(index)),
            # one row per sample: x, y (m), yaw (deg), hp, shield, alive, knocked
            "s": [
                [
                    round(float(f[X] - cx) / 100, 1), round(float(f[Y] - cy) / 100, 1),
                    round(float(f[YAW])), round(float(f[HP])), round(float(f[SHIELD])),
                    int(f[ALIVE] > 0.5), int(f[KNOCKED] > 0.5),
                ]
                for f in window[:, index, :]
            ],
        })
    kept = {p["id"] for p in players}
    shooter_ids = {int(i): pid for i, pid in index_to_player.items()}

    out_shots = [
        {
            "t": round(s["t"], 2),
            "p": shooter_ids.get(s["s"]),
            "team": s["team"],
            "ax": round((s["ax"] - cx) / 100, 1), "ay": round((s["ay"] - cy) / 100, 1),
            "ex": round((s["ex"] - cx) / 100, 1), "ey": round((s["ey"] - cy) / 100, 1),
            "sg": s["sg"],
        }
        for s in shots
        if window_s[0] <= s["t"] <= window_s[1] and shooter_ids.get(s["s"]) in kept
    ]

    # Rosters and labels for the card, from the full team lists.
    members: dict[int, list[str]] = {}
    for index, team in teams.items():
        pid = index_to_player.get(index)
        if pid:
            members.setdefault(team, []).append(pid)
    rosters = {t: sorted(names.get(p, p[:8]) for p in members.get(t, [])) for t in fight["teams"]}

    def relative(r: dict) -> dict:
        return {**r, "ax": (r["ax"] - cx) / 100, "ay": (r["ay"] - cy) / 100, "rx": (r["rx"] - cx) / 100, "ry": (r["ry"] - cy) / 100}

    out = {
        "matchId": match_id,
        "window": window_s,
        "sampleHz": SAMPLE_HZ,
        "players": players,
        "shots": out_shots,
        "fight": {**fight, "number": engagement_id + 1, "periphery": [], "records": [relative(r) for r in fight["records"]]},
        "teamRosters": rosters,
        "playerNames": {p["player_id"]: names.get(p["player_id"], p["player_id"][:8]) for p in fight["participants"]},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"{path.name}: {len(players)} players, {len(out_shots)} shots, {len(out['fight']['records'])} records, "
          f"{path.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()

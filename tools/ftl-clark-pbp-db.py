#!/usr/bin/env python3
"""Build and query the canonical Caitlin Clark / Indiana Fever play-by-play archive.

The official WNBA liveData feed is the event source of truth. Visual interpretation
belongs in Gemini analysis and is stored separately; it is never inferred from PBP.
"""
import argparse, datetime as dt, json, os, sqlite3, subprocess, tempfile, urllib.request

DEFAULT_DB = "/Volumes/SSK SSD/ftl-data/caitlin-clark-pbp.sqlite3"
FEVER_ID = "1611661325"
CLARK_ID = 1642286

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS games(
 game_id TEXT PRIMARY KEY, season INTEGER NOT NULL, season_type TEXT NOT NULL,
 game_date TEXT, matchup TEXT, opponent TEXT, result TEXT, clark_played INTEGER,
 boxscore_url TEXT NOT NULL, pbp_url TEXT NOT NULL, synced_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plays(
 game_id TEXT NOT NULL, action_number INTEGER NOT NULL, period INTEGER, clock TEXT,
 action_type TEXT, sub_type TEXT, descriptor TEXT, description TEXT,
 team_tricode TEXT, person_id INTEGER, assist_person_id INTEGER,
 shot_result TEXT, shot_distance REAL, score_away INTEGER, score_home INTEGER,
 raw_json TEXT NOT NULL, PRIMARY KEY(game_id, action_number));
CREATE INDEX IF NOT EXISTS plays_person ON plays(person_id);
CREATE INDEX IF NOT EXISTS plays_assister ON plays(assist_person_id);
CREATE INDEX IF NOT EXISTS plays_type ON plays(action_type, shot_result);
CREATE TABLE IF NOT EXISTS visual_analysis(
 game_id TEXT NOT NULL, action_number INTEGER NOT NULL, source_path TEXT NOT NULL,
 source_in REAL, source_out REAL, gemini_model TEXT, visual_summary TEXT,
 coverage TEXT, spacing TEXT, decision TEXT, annotation_json TEXT,
 verified_at TEXT, PRIMARY KEY(game_id, action_number, source_path));
CREATE TABLE IF NOT EXISTS essay_candidates(
 id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT NOT NULL, game_id TEXT NOT NULL,
 action_number INTEGER NOT NULL, rationale TEXT, status TEXT DEFAULT 'candidate',
 UNIQUE(topic, game_id, action_number));
"""

def connect(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    db=sqlite3.connect(path); db.row_factory=sqlite3.Row; db.executescript(SCHEMA); return db

def fetch_json(url):
    req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)

def game_rows(season, season_type):
    helper=os.path.join(os.path.dirname(__file__),"ftl-fetch-team-games.mjs")
    out=subprocess.check_output(["node",helper,"--season",str(season),"--season-type",season_type,"--team",FEVER_ID],text=True)
    return json.loads(out)

def sync(db, seasons):
    now=dt.datetime.now(dt.timezone.utc).isoformat(); totals={"games":0,"plays":0}
    for season in seasons:
      for season_type in ("Regular Season", "Playoffs"):
        try: games=game_rows(season, season_type)
        except Exception as e:
            print(f"WARN {season} {season_type}: {e}"); continue
        with tempfile.TemporaryDirectory() as tmp:
          helper=os.path.join(os.path.dirname(__file__),"ftl-fetch-team-games.mjs")
          ids=",".join(g["game_id"] for g in games)
          if ids: subprocess.check_call(["node",helper,"--game-ids",ids,"--out-dir",tmp],stdout=subprocess.DEVNULL)
          for g in games:
            gid=g["game_id"]
            box_url=f"https://cdn.wnba.com/static/json/liveData/boxscore/boxscore_{gid}.json"
            pbp_url=f"https://cdn.wnba.com/static/json/liveData/playbyplay/playbyplay_{gid}.json"
            try:
                bundle=json.load(open(os.path.join(tmp,f"{gid}.json")))
                box,pbp=bundle["box"],bundle["pbp"]
            except Exception as e:
                print(f"WARN {gid}: {e}"); continue
            game=box.get("game",{}); teams=[game.get("awayTeam",{}),game.get("homeTeam",{})]
            fever=next((t for t in teams if str(t.get("teamId"))==FEVER_ID),{})
            opp=next((t for t in teams if str(t.get("teamId"))!=FEVER_ID),{})
            players=fever.get("players",[]); played=any(p.get("personId")==CLARK_ID and p.get("played") != "0" for p in players)
            db.execute("""INSERT OR REPLACE INTO games VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
              (gid,season,season_type,g.get("date"),g.get("matchup"),opp.get("teamTricode"),g.get("wl"),int(played),box_url,pbp_url,now))
            actions=pbp.get("game",{}).get("actions",[])
            for a in actions:
                db.execute("""INSERT OR REPLACE INTO plays VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(
                  gid,a.get("actionNumber"),a.get("period"),a.get("clock"),a.get("actionType"),a.get("subType"),
                  a.get("descriptor"),a.get("description"),a.get("teamTricode"),a.get("personId"),a.get("assistPersonId"),
                  a.get("shotResult"),a.get("shotDistance"),a.get("scoreAway"),a.get("scoreHome"),json.dumps(a,separators=(",",":"))))
            totals["games"]+=1; totals["plays"]+=len(actions); print(f"{season} {season_type}: {gid} {len(actions)} plays")
        db.commit()
    print(json.dumps(totals))

def summary(db):
    row=db.execute("""SELECT COUNT(*) games, SUM(clark_played) clark_games, MIN(game_date) first_game,
      MAX(game_date) last_game FROM games""").fetchone()
    events=db.execute("""SELECT COUNT(*) total_plays,
      SUM(person_id=?) direct_clark_events, SUM(assist_person_id=?) clark_assists,
      SUM(person_id=? AND action_type='3pt' AND shot_result='Made') made_threes,
      SUM(person_id=? AND action_type='rebound') rebounds,
      SUM(person_id=? AND action_type='steal') steals FROM plays""",
      (CLARK_ID,CLARK_ID,CLARK_ID,CLARK_ID,CLARK_ID)).fetchone()
    print(json.dumps({**dict(row),**dict(events)},indent=2))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--db",default=DEFAULT_DB)
    sub=ap.add_subparsers(dest="cmd",required=True)
    s=sub.add_parser("sync"); s.add_argument("--seasons",default="2024,2025,2026")
    sub.add_parser("summary")
    q=sub.add_parser("query"); q.add_argument("sql")
    a=ap.parse_args(); db=connect(a.db)
    if a.cmd=="sync": sync(db,[int(x) for x in a.seasons.split(",")])
    elif a.cmd=="summary": summary(db)
    else:
      cur=db.execute(a.sql); print(json.dumps([dict(r) for r in cur.fetchall()],indent=2))

if __name__ == "__main__": main()

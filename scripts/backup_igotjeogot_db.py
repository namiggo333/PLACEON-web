"""이곳저곳 운영 Supabase DB 백업 — 주요 테이블 전체를 하나의 JSON으로 저장.

사용: python3 scripts/backup_igotjeogot_db.py [출력경로]
- placeon-web/.env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 사용
- /rest/v1/{table}?select=* 를 Range 헤더로 1000건씩 페이지네이션해 전부 조회
- 404(테이블 없음)는 건너뛰고 기록
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(PROJECT_DIR, ".env.local")
TABLES = ["profiles", "admins", "spaces", "space_accounts", "bookings", "reviews"]
PAGE = 1000
KST = timezone(timedelta(hours=9))


def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def fetch_table(base: str, key: str, table: str) -> dict:
    rows: list = []
    start = 0
    while True:
        url = f"{base}/rest/v1/{table}?select=*"
        req = urllib.request.Request(url, method="GET")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        req.add_header("Accept", "application/json")
        req.add_header("Prefer", "count=exact")
        req.add_header("Range", f"{start}-{start + PAGE - 1}")
        req.add_header("Range-Unit", "items")
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                body = res.read().decode("utf-8", "replace")
                data = json.loads(body) if body else []
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", "replace")[:400]
            if e.code == 404:
                return {"status": "missing", "http_status": 404, "rows": 0, "detail": err_body}
            return {"status": "error", "http_status": e.code, "rows": len(rows), "detail": err_body}
        if not isinstance(data, list):
            return {"status": "error", "http_status": 200, "rows": len(rows), "detail": str(data)[:400]}
        rows.extend(data)
        if len(data) < PAGE:
            break
        start += PAGE
    return {"status": "ok", "http_status": 200, "rows": len(rows), "data": rows}


def main() -> int:
    out_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "/workspace/downloads/igotjeogot-db-backup/igotjeogot-db-2026-11-18.json"
    )
    env = load_env(ENV_PATH)
    base = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음", file=sys.stderr)
        return 2

    started = datetime.now(KST)
    tables: dict[str, dict] = {}
    for table in TABLES:
        res = fetch_table(base, key, table)
        tables[table] = res
        print(f"{table}: {res['status']} rows={res['rows']}", file=sys.stderr)

    finished = datetime.now(KST)
    payload = {
        "project": "이곳저곳 (placeon-web)",
        "supabase_url": base,
        "backup_at_kst": started.isoformat(timespec="seconds"),
        "backup_finished_kst": finished.isoformat(timespec="seconds"),
        "tables_requested": TABLES,
        "summary": {t: {"status": r["status"], "rows": r["rows"]} for t, r in tables.items()},
        "total_rows": sum(r["rows"] for r in tables.values()),
        "tables": tables,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
    size = os.path.getsize(out_path)
    print(f"saved {out_path} ({size} bytes)", file=sys.stderr)
    print(json.dumps({"path": out_path, "bytes": size, "summary": payload["summary"],
                      "total_rows": payload["total_rows"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

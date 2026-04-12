"""
Dark Horse entity resolution job.

Runs Splink (Fellegi-Sunter probabilistic record linkage) over the Person and
Organization tables to find cross-source duplicates that share identity but
not identifiers. Candidate matches are written to the EntityMatch table for
review in the admin UI.

Thresholds:
    score > 0.95  → auto_merged
    0.80 ≤ s ≤ .95 → needs_review
    < 0.80        → dropped

Runs as a Cloud Run Job on a nightly schedule. See Dockerfile.entity-res.

Required env:
    DATABASE_URL   — Cloud SQL Postgres connection string
"""

import os
import sys
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_batch

from schema import build_person_settings, build_organization_settings

MIN_AUTO_MERGE = 0.95
MIN_NEEDS_REVIEW = 0.80


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1

    print(f"[{datetime.utcnow().isoformat()}] entity-resolution starting")

    with psycopg2.connect(database_url) as conn:
        run_person_matching(conn)
        run_organization_matching(conn)
        conn.commit()

    print(f"[{datetime.utcnow().isoformat()}] entity-resolution complete")
    return 0


def run_person_matching(conn) -> None:
    print("  running Person matching")

    # Late-import Splink so this file at least parses without it installed.
    from splink.duckdb.linker import DuckDBLinker  # type: ignore

    rows = fetch_rows(
        conn,
        """
        SELECT
            id,
            COALESCE("givenName", '') AS given_name,
            COALESCE("middleName", '') AS middle_name,
            COALESCE("familyName", '') AS family_name,
            COALESCE("suffix", '') AS suffix,
            COALESCE("dateOfBirth"::text, '') AS dob,
            COALESCE("party", '') AS party,
            "fecCandidateId",
            "laEthicsId",
            "wikidataQid"
        FROM "Person"
        """,
    )
    if len(rows) < 2:
        print(f"    only {len(rows)} people — nothing to match")
        return

    linker = DuckDBLinker(rows, build_person_settings())
    linker.estimate_probability_two_random_records_match(
        [
            'l.family_name = r.family_name and l.given_name = r.given_name',
            'l."fecCandidateId" = r."fecCandidateId"',
            'l."laEthicsId" = r."laEthicsId"',
        ],
        recall=0.7,
    )
    linker.estimate_u_using_random_sampling(max_pairs=1_000_000)
    df_predictions = linker.predict(threshold_match_probability=MIN_NEEDS_REVIEW)
    matches = df_predictions.as_pandas_dataframe()

    print(f"    {len(matches)} candidate matches above {MIN_NEEDS_REVIEW}")
    upsert_matches(conn, matches, entity_type="person")


def run_organization_matching(conn) -> None:
    print("  running Organization matching")
    from splink.duckdb.linker import DuckDBLinker  # type: ignore

    rows = fetch_rows(
        conn,
        """
        SELECT
            id,
            COALESCE("name", '') AS name,
            COALESCE("orgType", '') AS org_type,
            "fecCommitteeId",
            "einNumber",
            "wikidataQid"
        FROM "Organization"
        """,
    )
    if len(rows) < 2:
        print(f"    only {len(rows)} orgs — nothing to match")
        return

    linker = DuckDBLinker(rows, build_organization_settings())
    linker.estimate_probability_two_random_records_match(
        [
            'l."fecCommitteeId" = r."fecCommitteeId"',
            'l."einNumber" = r."einNumber"',
        ],
        recall=0.8,
    )
    linker.estimate_u_using_random_sampling(max_pairs=500_000)
    df_predictions = linker.predict(threshold_match_probability=MIN_NEEDS_REVIEW)
    matches = df_predictions.as_pandas_dataframe()

    print(f"    {len(matches)} candidate org matches above {MIN_NEEDS_REVIEW}")
    upsert_matches(conn, matches, entity_type="organization")


def fetch_rows(conn, sql: str):
    with conn.cursor() as cur:
        cur.execute(sql)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def upsert_matches(conn, matches, entity_type: str) -> None:
    if matches.empty:
        return

    to_insert = []
    for _, m in matches.iterrows():
        score = float(m["match_probability"])
        status = "auto_merged" if score >= MIN_AUTO_MERGE else "needs_review"
        to_insert.append(
            (
                f"em_{m['unique_id_l']}_{m['unique_id_r']}",
                entity_type,
                m["unique_id_l"],
                entity_type,
                m["unique_id_r"],
                score,
                status,
            )
        )

    with conn.cursor() as cur:
        execute_batch(
            cur,
            """
            INSERT INTO "EntityMatch" (
                id, "leftEntityType", "leftEntityId", "rightEntityType",
                "rightEntityId", score, status, "matchedAt"
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE
            SET score = EXCLUDED.score,
                status = EXCLUDED.status,
                "matchedAt" = NOW()
            """,
            to_insert,
            page_size=500,
        )


if __name__ == "__main__":
    sys.exit(main())

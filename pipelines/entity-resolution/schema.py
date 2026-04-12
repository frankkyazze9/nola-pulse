"""
Splink settings for Dark Horse entity resolution.

Blocking rules keep the pair comparison tractable; comparisons are Fellegi-Sunter
probabilistic matches over name components + known IDs.
"""

from typing import Any, Dict


def build_person_settings() -> Dict[str, Any]:
    return {
        "link_type": "dedupe_only",
        "blocking_rules_to_generate_predictions": [
            # Same family name + same first letter of given name
            'substr(l.given_name, 1, 1) = substr(r.given_name, 1, 1) '
            'and l.family_name = r.family_name',
            # Same FEC candidate ID
            'l."fecCandidateId" = r."fecCandidateId"',
            # Same LA Ethics ID
            'l."laEthicsId" = r."laEthicsId"',
            # Same Wikidata QID
            'l."wikidataQid" = r."wikidataQid"',
            # Same DOB + soundex family name
            'l.dob = r.dob and soundex(l.family_name) = soundex(r.family_name)',
        ],
        "comparisons": [
            {
                "output_column_name": "family_name",
                "comparison_levels": [
                    {"sql_condition": "l.family_name IS NULL OR r.family_name IS NULL", "label_for_charts": "Null"},
                    {"sql_condition": "l.family_name = r.family_name", "label_for_charts": "Exact", "m_probability": 0.85, "u_probability": 0.05},
                    {"sql_condition": "jaro_winkler_similarity(l.family_name, r.family_name) >= 0.92", "label_for_charts": "Jaro-Winkler >= 0.92", "m_probability": 0.10, "u_probability": 0.10},
                    {"sql_condition": "jaro_winkler_similarity(l.family_name, r.family_name) >= 0.88", "label_for_charts": "Jaro-Winkler >= 0.88", "m_probability": 0.03, "u_probability": 0.15},
                    {"sql_condition": "ELSE", "label_for_charts": "All other comparisons", "m_probability": 0.02, "u_probability": 0.70},
                ],
            },
            {
                "output_column_name": "given_name",
                "comparison_levels": [
                    {"sql_condition": "l.given_name IS NULL OR r.given_name IS NULL", "label_for_charts": "Null"},
                    {"sql_condition": "l.given_name = r.given_name", "label_for_charts": "Exact", "m_probability": 0.80, "u_probability": 0.05},
                    {"sql_condition": "jaro_winkler_similarity(l.given_name, r.given_name) >= 0.90", "label_for_charts": "Jaro-Winkler >= 0.90", "m_probability": 0.12, "u_probability": 0.15},
                    {"sql_condition": "substr(l.given_name, 1, 1) = substr(r.given_name, 1, 1)", "label_for_charts": "Same first letter", "m_probability": 0.05, "u_probability": 0.20},
                    {"sql_condition": "ELSE", "label_for_charts": "All other comparisons", "m_probability": 0.03, "u_probability": 0.60},
                ],
            },
            {
                "output_column_name": "dob",
                "comparison_levels": [
                    {"sql_condition": "l.dob IS NULL OR r.dob IS NULL OR l.dob = '' OR r.dob = ''", "label_for_charts": "Null"},
                    {"sql_condition": "l.dob = r.dob", "label_for_charts": "Exact", "m_probability": 0.95, "u_probability": 0.01},
                    {"sql_condition": "ELSE", "label_for_charts": "All other comparisons", "m_probability": 0.05, "u_probability": 0.99},
                ],
            },
        ],
        "retain_matching_columns": True,
        "retain_intermediate_calculation_columns": False,
        "unique_id_column_name": "id",
    }


def build_organization_settings() -> Dict[str, Any]:
    return {
        "link_type": "dedupe_only",
        "blocking_rules_to_generate_predictions": [
            'l."fecCommitteeId" = r."fecCommitteeId"',
            'l."einNumber" = r."einNumber"',
            'l."wikidataQid" = r."wikidataQid"',
            'soundex(l.name) = soundex(r.name) and l.org_type = r.org_type',
        ],
        "comparisons": [
            {
                "output_column_name": "name",
                "comparison_levels": [
                    {"sql_condition": "l.name IS NULL OR r.name IS NULL", "label_for_charts": "Null"},
                    {"sql_condition": "l.name = r.name", "label_for_charts": "Exact", "m_probability": 0.85, "u_probability": 0.05},
                    {"sql_condition": "jaro_winkler_similarity(l.name, r.name) >= 0.92", "label_for_charts": "Jaro-Winkler >= 0.92", "m_probability": 0.10, "u_probability": 0.15},
                    {"sql_condition": "jaro_winkler_similarity(l.name, r.name) >= 0.88", "label_for_charts": "Jaro-Winkler >= 0.88", "m_probability": 0.03, "u_probability": 0.20},
                    {"sql_condition": "ELSE", "label_for_charts": "All other comparisons", "m_probability": 0.02, "u_probability": 0.60},
                ],
            },
            {
                "output_column_name": "org_type",
                "comparison_levels": [
                    {"sql_condition": "l.org_type IS NULL OR r.org_type IS NULL", "label_for_charts": "Null"},
                    {"sql_condition": "l.org_type = r.org_type", "label_for_charts": "Exact", "m_probability": 0.90, "u_probability": 0.20},
                    {"sql_condition": "ELSE", "label_for_charts": "All other comparisons", "m_probability": 0.10, "u_probability": 0.80},
                ],
            },
        ],
        "retain_matching_columns": True,
        "retain_intermediate_calculation_columns": False,
        "unique_id_column_name": "id",
    }

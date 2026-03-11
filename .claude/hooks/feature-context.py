#!/usr/bin/env python3
"""
Injects dynamic feature context at the start of each Claude Code session.
stdout on SessionStart is added as context that Claude sees.

Reads feature-roadmap.json + git log + TODO scan to build a context snapshot.
"""
import json
import subprocess
import sys
from pathlib import Path


def get_recent_changes():
    """Analyze git log to understand recent progress."""
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-5", "--no-decorate"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip()
    except Exception:
        return ""


def get_open_todos():
    """Find TODO/FIXME/HACK in source code."""
    try:
        result = subprocess.run(
            ["grep", "-rn", r"TODO\|FIXME\|HACK", "src/", "packages/",
             "--include=*.ts", "--include=*.tsx", "--include=*.js",
             "--include=*.jsx", "-l"],
            capture_output=True, text=True, timeout=5
        )
        files = [f for f in result.stdout.strip().split('\n') if f]
        return files[:5]
    except Exception:
        return []


def load_roadmap():
    """Load feature roadmap from project config."""
    roadmap_path = Path(".claude/feature-roadmap.json")
    if roadmap_path.exists():
        with open(roadmap_path) as f:
            return json.load(f)
    return None


def format_sprint_progress(features, sprint_name):
    """Calculate sprint completion percentage."""
    sprint_features = [f for f in features if f.get("sprint") == sprint_name]
    if not sprint_features:
        return ""
    done = sum(1 for f in sprint_features if f.get("status") == "done")
    total = len(sprint_features)
    pct = int(done / total * 100)
    return f"SPRINT PROGRESS: {sprint_name} — {done}/{total} ({pct}%)"


def main():
    roadmap = load_roadmap()
    recent = get_recent_changes()
    todos = get_open_todos()

    parts = []
    parts.append("=== PROJECT FEATURE CONTEXT ===")

    if roadmap:
        features = roadmap.get("features", [])
        sprint = roadmap.get("current_sprint", "")

        # Sprint progress
        progress = format_sprint_progress(features, sprint)
        if progress:
            parts.append(progress)

        # Currently building
        in_progress = [f for f in features if f.get("status") == "in_progress"]
        for f in in_progress[:2]:
            files = ", ".join(f.get("files", []))
            parts.append(
                f"CURRENTLY BUILDING: {f['name']} — {f.get('description', '')}"
                + (f" [files: {files}]" if files else "")
            )

        # Suggested next
        next_up = [f for f in features if f.get("status") == "next"]
        for f in next_up[:2]:
            parts.append(
                f"SUGGESTED NEXT: {f['name']} — {f.get('description', '')}"
            )

        # Blocked items
        blocked = [f for f in features if f.get("status") == "blocked"]
        for f in blocked[:2]:
            deps = ", ".join(f.get("depends_on", []))
            parts.append(f"BLOCKED: {f['name']} — waiting on: {deps}")

    if recent:
        parts.append(f"RECENT COMMITS:\n{recent}")

    if todos:
        parts.append(f"FILES WITH TODOs: {', '.join(todos)}")

    parts.append("=== END CONTEXT ===")

    # stdout on SessionStart → Claude sees as context
    print('\n'.join(parts))


if __name__ == "__main__":
    main()

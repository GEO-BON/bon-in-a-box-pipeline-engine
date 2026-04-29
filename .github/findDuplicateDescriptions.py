#!/usr/bin/env python3

# This script detects duplicate values for description/text/link keys inside each YAML description file.
# It was converted by AI from a former bash script.

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

RED = "\033[31m"
ENDCOLOR = "\033[0m"

# These keys will be checked for duplicates
TARGET_KEYS = {"description", "text", "link"}


def normalize(value: Any) -> str:
    # Fold whitespace so wrapped multiline strings compare as expected.
    return " ".join(str(value).split())


def walk(node: Any, found: dict[str, list[tuple[str, str]]]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key in TARGET_KEYS and isinstance(value, (str, int, float, bool)):
                found[key].append((normalize(value), str(value)))
            walk(value, found)
        return

    if isinstance(node, list):
        for item in node:
            walk(item, found)


def iter_yaml_files(root: Path) -> list[Path]:
    yml = list(root.rglob("*.yml"))
    yaml = list(root.rglob("*.yaml"))
    return sorted(yml + yaml)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Detect duplicate values for description/text/link keys inside each YAML file."
        )
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=".",
        help="Root directory to scan recursively (default: current directory)",
    )
    args = parser.parse_args()

    try:
        import yaml
    except ImportError:
        print("PyYAML is required. Install it with: pip install pyyaml", file=sys.stderr)
        return 2

    root = Path(args.root)
    print("Checking for duplicate values inside each yml/yaml file...")

    any_duplicates = False
    for file_path in iter_yaml_files(root):
        try:
            content = file_path.read_text(encoding="utf-8")
            data = yaml.safe_load(content)
        except Exception as exc:
            print(f"Skipping {file_path}: {exc}", file=sys.stderr)
            continue

        if data is None:
            continue

        found: dict[str, list[tuple[str, str]]] = defaultdict(list)
        walk(data, found)

        error_lines: list[str] = []
        for key in sorted(TARGET_KEYS):
            grouped: dict[str, list[str]] = defaultdict(list)
            for normalized, original in found[key]:
                grouped[normalized].append(original)

            for normalized_value, originals in grouped.items():
                if normalized_value and len(originals) > 1:
                    any_duplicates = True
                    sample = originals[0].replace("\n", " ").strip()
                    error_lines.append(
                        f"{RED}[DUPLICATE] in {file_path} at {key}: {sample}{ENDCOLOR}"
                    )

        for line in error_lines:
            print(line)

    if any_duplicates:
        return 1

    print("No duplicates found.")
    print("")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

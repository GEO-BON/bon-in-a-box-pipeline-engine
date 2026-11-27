#!/usr/bin/env python3
"""Fix common French typography in JSON string values or Markdown prose.

Run from the ui/ directory, for example:

    python3 scripts/fix_french_typography.py src/locales/fr/translation.json
    python3 scripts/fix_french_typography.py --check ../path/to/french.md

The file is edited in place unless --check is provided. With --check, the exit
status is 1 if changes are needed and 0 otherwise; errors return 2.
JSON keys and common Markdown code, links and placeholders are preserved.
The fixes are heuristic: review the diff, particularly for technical content.
"""

import argparse
import json
import re
import sys
from pathlib import Path

NBSP = "\u00a0"
NNBSP = "\u202f"

# Keep machine-readable text and Markdown syntax out of the replacements.
PROTECTED = re.compile(
    r"{{[\s\S]*?}}"
    r"|`+[^`\n]*`+"
    r"|\\[^\n]"
    r"|<!--[\s\S]*?-->"
    r"|<[^>\n]*>"
    r"|(?<=\])\([^)\n]*\)"
    r"|(?<=\])\[[^]\n]*\]"
    r"|https?://[^\s<>]+"
    r"|[\w.+-]+@[\w.-]+\.[\w-]+"
    r"|&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);"
    r"|\b[\w-]+(?:\.[\w-]+)+\b"
)
JSON_STRING = re.compile(r'"(?:\\.|[^"\\])*"')
FENCE = re.compile(r"^(?: {0,3}> ?)*(?: {0,3}[-+*] )? {0,3}(`{3,}|~{3,})")


def fix_prose(text):
    text = text.replace("...", "…").replace("'", "’")
    text = re.sub(r"[ \u00a0]+([?!;])", NNBSP + r"\1", text)
    text = re.sub(r":(?=[^\s\d])", ": ", text)
    text = re.sub(r"(?<!\u00a0)[ \u202f]*:(?=\s|$)", NBSP + ":", text)
    text = re.sub(r"[ \u00a0\u202f]+([,.])", r"\1", text)
    text = re.sub(r'([,.])(?=[^\s\d.,)\]"»”’])', r"\1 ", text)
    text = re.sub(r"«[ \u00a0\u202f]*", "«" + NBSP, text)
    text = re.sub(r"[ \u00a0\u202f]*»", NBSP + "»", text)
    text = re.sub(r"\( +", "(", text)
    text = re.sub(r" +\)", ")", text)
    text = re.sub(r"(\d)[ \u202f]*%", r"\1" + NBSP + "%", text)
    text = re.sub(r" +([—–])", NBSP + r"\1", text)
    return re.sub(r" {2,}", " ", text)


def fix_text(text):
    marker = "\ue000"
    while marker in text:
        marker += "\ue000"
    protected = []

    def mask(match):
        protected.append(match.group())
        return f"{marker}{len(protected) - 1}\ue001"

    text = fix_prose(PROTECTED.sub(mask, text))
    for index, value in enumerate(protected):
        text = text.replace(f"{marker}{index}\ue001", value)
    return text


def fix_json(source):
    json.loads(source)

    def replace(match):
        token = match.group()
        # A JSON string followed by a colon is an object key, not prose.
        if source[match.end():].lstrip().startswith(":"):
            return token
        value = json.loads(token)
        fixed = fix_text(value).strip()
        return token if fixed == value else json.dumps(fixed, ensure_ascii=False)

    result = JSON_STRING.sub(replace, source)
    json.loads(result)
    return result


def fix_markdown(source):
    lines = source.splitlines(keepends=True)
    result = []
    fence = None
    frontmatter = bool(lines and lines[0].strip() == "---")
    for index, line in enumerate(lines):
        if frontmatter:
            result.append(line)
            if index and line.strip() in ("---", "..."):
                frontmatter = False
            continue
        match = FENCE.match(line)
        if fence:
            result.append(line)
            if match and match.group(1)[0] == fence[0] and len(match.group(1)) >= len(fence):
                fence = None
            continue
        if match:
            fence = match.group(1)
            result.append(line)
            continue
        if re.match(r"^(?: {4}|\t|\s*\[[^]]+\]:)", line):
            result.append(line)
            continue
        # Preserve indentation and the two trailing spaces used for a hard line break.
        match = re.match(r"^([ \t]*)(.*?)( {2,})?(\r?\n)?$", line)
        indent, content, hard_break, newline = match.groups()
        result.append(indent + fix_text(content) + (hard_break or "") + (newline or ""))
    return "".join(result)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("file", type=Path, help="French .json, .md, or .markdown file")
    parser.add_argument("--check", action="store_true", help="report changes without writing")
    args = parser.parse_args()
    suffix = args.file.suffix.lower()
    if suffix not in (".json", ".md", ".markdown"):
        parser.error("expected a .json, .md, or .markdown file")
    try:
        with args.file.open("r", encoding="utf-8", newline="") as stream:
            source = stream.read()
        result = fix_json(source) if suffix == ".json" else fix_markdown(source)
        if result == source:
            print(f"No changes: {args.file}")
            return 0
        if args.check:
            print(f"Changes needed: {args.file}")
            return 1
        with args.file.open("w", encoding="utf-8", newline="") as stream:
            stream.write(result)
        print(f"Updated: {args.file}")
        return 0
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"{args.file}: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from fix_french_typography import fix_json, fix_markdown, fix_text

SCRIPT = Path(__file__).with_name("fix_french_typography.py")


class TypographyTests(unittest.TestCase):
    def test_punctuation_and_idempotence(self):
        source = "L'exemple : « bonjour » ! Vraiment? Oui ; 50% - et 10 % — ( ici )...  Suite ,oui."
        expected = (
            "L’exemple\u00a0: «\u00a0bonjour\u00a0»\u202f! Vraiment? "
            "Oui\u202f; 50\u00a0% - et 10\u00a0% \u00a0— (ici)… Suite, oui."
        ).replace(" \u00a0—", "\u00a0—")
        self.assertEqual(fix_text(source), expected)
        self.assertEqual(fix_text(expected), expected)

    def test_punctuation_next_to_placeholders(self):
        source = "Bonjour,{{name}}! Voir:{{value}} et {{name}}: oui."
        self.assertEqual(
            fix_text(source),
            "Bonjour, {{name}}! Voir\u00a0: {{value}} et {{name}}\u00a0: oui.",
        )

    def test_json_preserves_keys_formatting_and_placeholders(self):
        source = '{\n  "l\'id": "Bonjour : {{name}} !",\n  "nested": ["L\'ami...", 3, true],\n  "url": "https://example.com/a?x=1",\n  "escaped": "A\\u0062c"\n}\n'
        result = fix_json(source)
        self.assertEqual(
            result,
            '{\n  "l\'id": "Bonjour\u00a0: {{name}}\u202f!",\n'
            '  "nested": ["L’ami…", 3, true],\n'
            '  "url": "https://example.com/a?x=1",\n'
            '  "escaped": "A\\u0062c"\n}\n',
        )
        self.assertEqual(json.loads(result)["l'id"], "Bonjour\u00a0: {{name}}\u202f!")
        self.assertEqual(fix_json(result), result)

    def test_markdown_preserves_syntax_and_code(self):
        source = (
            "---\ntitle: L'exemple : oui\n---\n"
            "# L'exemple : oui !\n"
            "[L'ami](https://example.com/a?x=1) et `x = 'hello'`  \n"
            "[Documentation.](guide.md) et [autre][ref].\n"
            "Voir fichier.json et <span title=\"l'exemple\">l'ami</span>.\n"
            "```json\n{\"message\": \"L'exemple : oui\"}\n```\n"
            "    code = 'un : deux'\n"
            "[ref]: https://example.com/?q=test\n"
        )
        result = fix_markdown(source)
        self.assertEqual(
            result,
            "---\ntitle: L'exemple : oui\n---\n"
            "# L’exemple\u00a0: oui\u202f!\n"
            "[L’ami](https://example.com/a?x=1) et `x = 'hello'`  \n"
            "[Documentation.](guide.md) et [autre][ref].\n"
            "Voir fichier.json et <span title=\"l'exemple\">l’ami</span>.\n"
            "```json\n{\"message\": \"L'exemple : oui\"}\n```\n"
            "    code = 'un : deux'\n"
            "[ref]: https://example.com/?q=test\n",
        )
        self.assertEqual(fix_markdown(result), result)

    def test_cli_check_write_and_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fr.json"
            path.write_text('{"message": "Salut !"}\n', encoding="utf-8")
            check = subprocess.run([sys.executable, SCRIPT, "--check", path], capture_output=True)
            self.assertEqual(check.returncode, 1)
            self.assertEqual(path.read_text(encoding="utf-8"), '{"message": "Salut !"}\n')
            write = subprocess.run([sys.executable, SCRIPT, path], capture_output=True)
            self.assertEqual(write.returncode, 0)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["message"], "Salut\u202f!")
            self.assertEqual(subprocess.run([sys.executable, SCRIPT, "--check", path], capture_output=True).returncode, 0)
            path.write_text('{"message": ', encoding="utf-8")
            invalid = subprocess.run([sys.executable, SCRIPT, path], capture_output=True)
            self.assertEqual(invalid.returncode, 2)
            self.assertEqual(path.read_text(encoding="utf-8"), '{"message": ')


if __name__ == "__main__":
    unittest.main()

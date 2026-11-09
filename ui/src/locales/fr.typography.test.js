import { describe, expect, it } from "vitest";
import fr from "./fr/translation.json";

// Rules from the OQLF "Espacement avant et après les signes de ponctuation et les symboles":
// https://vitrinelinguistique.oqlf.gouv.qc.ca/22039/la-typographie/espacement/espacement-avant-et-apres-les-signes-de-ponctuation-et-les-symboles
const NBSP = "\u00a0";
const NNBSP = "\u202f";

const flatten = (object, prefix = "") =>
  Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value]] : flatten(value, path);
  });

// Interpolation placeholders and markup are not French text.
const prose = (value) => value.replace(/{{[^}]*}}/g, "X").replace(/<\/?\w+>/g, "");

// Each rule reports the offending text; `pattern` matches violations only.
const rules = [
  { name: "before ? ! ; use no space or a narrow no-break space (U+202F), never a regular space", pattern: /[ \u00a0][?!;]/g },
  { name: "a colon needs a no-break space (U+00A0) before it", pattern: /[^\u00a0]:(?=\s|$)/g },
  { name: "a colon must be followed by a regular space or end the text", pattern: /:[^\s\d]/g },
  { name: "no space before , or .", pattern: /\s[,.]/g },
  { name: "a comma or period must be followed by a space or end the text", pattern: /[,.][^\s\d.,)"»”’]/g },
  { name: "guillemets need a no-break space inside: « text »", pattern: /«(?!\u00a0)|(?<!\u00a0)»/g },
  { name: "no space inside an opening parenthesis or before a closing one", pattern: /\( | \)/g },
  { name: "a percent sign needs a no-break space before it when after a number", pattern: /\d[ \u202f]?%/g },
  { name: "a dash needs a no-break space, not a regular space, before it", pattern: / [—–]/g },
  { name: "use the typographic apostrophe ’ rather than '", pattern: /'/g },
  { name: "use the ellipsis character … rather than three periods", pattern: /\.\.\./g },
  { name: "no double spaces", pattern: / {2}/g },
  { name: "no leading or trailing space", pattern: /^\s|\s$/g },
];

describe("French typography (OQLF)", () => {
  const entries = flatten(fr);

  it.each(rules)("$name", ({ pattern, ignore }) => {
    const violations = entries.flatMap(([key, value]) =>
      [...prose(value).matchAll(pattern)]
        .filter((match) => !ignore?.test(match[0]))
        .map((match) => `${key}: ${JSON.stringify(match[0])}`)
    );
    expect(violations).toEqual([]);
  });

  it("has narrow no-break spaces before the question marks (sanity check)", () => {
    expect(entries.some(([, value]) => value.includes(`${NNBSP}?`))).toBe(true);
    expect(entries.some(([, value]) => value.includes(`${NBSP}:`))).toBe(true);
  });
});

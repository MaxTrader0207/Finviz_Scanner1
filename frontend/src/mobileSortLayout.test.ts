import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const home = readFileSync(resolve(root, "src/pages/Home.tsx"), "utf8");
const mobileCss = readFileSync(resolve(root, "src/mobile.css"), "utf8");

describe("mobile sort control layout", () => {
  it("keeps sorting, search, and sector controls available in the mobile layout", () => {
    expect(home).toContain('className="mobile-sort-control"');
    expect(home).toContain('className="mobile-sort-select"');
    expect(home).toContain('className="mobile-sort-direction"');
    expect(mobileCss).toContain(".table-controls { gap: 8px; margin: 16px 0 9px; }");
    expect(mobileCss).toContain(".search-control, .select-control { height: 46px; }");
    expect(mobileCss).toContain(".mobile-sort-control { min-height: 46px; display: grid;");
    expect(mobileCss).toContain("grid-template-columns: 52px minmax(0, 1fr) auto;");
  });
});

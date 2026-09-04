import { describe, expect, it } from "vitest";
import { buildDefaultPdfFileName, buildWatchlistPdfFileName, sanitizePdfFileName } from "./pdfExport";

describe("PDF filename helpers", () => {
  it("uses ticker and company in the default PDF filename", () => {
    expect(buildDefaultPdfFileName("ALM", "Almonty Industries Inc")).toBe("Signal-Ledger-ALM-Almonty Industries Inc-AI-Summary");
  });

  it("uses a stable filename for personal watchlist exports", () => {
    expect(buildWatchlistPdfFileName()).toBe("Signal-Ledger-Watchlist");
  });

  it("removes a PDF extension and unsafe filename characters", () => {
    expect(sanitizePdfFileName('ALM: Summary/2026?.pdf')).toBe("ALM- Summary-2026-");
  });

  it("falls back to a stable filename when input contains no usable characters", () => {
    expect(sanitizePdfFileName("   ")).toBe("Signal-Ledger-AI-Summary");
  });
});

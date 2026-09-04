import { describe, expect, it, vi } from "vitest";
import { scrollToScreenTop } from "./screenNavigation";

describe("篩選視角置頂", () => {
  it("將視窗立即捲回視角內容最上方", () => {
    const scrollTo = vi.fn();

    scrollToScreenTop(scrollTo);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });
});

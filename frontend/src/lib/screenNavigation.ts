export function scrollToScreenTop(scrollTo: (options: ScrollToOptions) => void) {
  scrollTo({ top: 0, left: 0, behavior: "auto" });
}

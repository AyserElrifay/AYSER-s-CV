/**
 * A number inside text.
 *
 * This is the RTL bug that bites hardest and shows up latest. An amount at the
 * end of an Arabic sentence — "الحد الأدنى 50,000.00" — gets reordered by the
 * bidirectional algorithm, because the digits, the comma and the full stop have
 * different bidi strengths and the run around them is right-to-left. The result
 * is a number that is quietly, plausibly wrong: separators migrate, a minus
 * sign lands on the far end.
 *
 * `<bdi>` opens a bidi isolate, so whatever is inside is laid out on its own
 * and cannot be reordered by its surroundings. It is the element the spec added
 * for exactly this, and it costs nothing.
 *
 * Every figure rendered next to prose goes through here. Figures alone in their
 * own cell do not strictly need it, but they get it anyway — the rule is easier
 * to keep than the exception is to remember.
 */
export function Figure({ children }: { children: React.ReactNode }) {
  return (
    <bdi dir="ltr" className="figure">
      {children}
    </bdi>
  );
}

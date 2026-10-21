/** Inside the fixtures' review window (reviews expire 12:05Z). Only Date is faked; timers run. */
export const TEST_NOW = new Date('2026-10-21T12:01:00Z');

let wideLayout = false;

/** Switches the viewport width query between the phone and desktop layouts. */
export function setWideLayout(wide: boolean): void {
  wideLayout = wide;
}

export function isWideLayout(): boolean {
  return wideLayout;
}

export const BREAKPOINTS = {
  compact: 560,
  mobile: 720,
  tablet: 900,
  desktop: 1180,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

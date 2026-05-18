// nakama/src/integrations/api_football.ts
// Placeholder — full implementation lands in task 02-02-02 of plan 02-02.
// The export is present here so scheduler/tick.ts can import it and the build
// stays typecheck-clean between commits within plan 02-02.

export function pollFixtures(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _windowDays: number,
): number {
  logger.info('[api-football][stub] pollFixtures called — real impl lands in 02-02-02');
  return 0;
}

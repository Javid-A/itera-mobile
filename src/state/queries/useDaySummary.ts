import { useQuery } from "@tanstack/react-query";
import { getDaySummary } from "../../api/missions";
import { qk } from "../queryKeys";
import type { DaySummaryResponse } from "../../types/DaySummary";

export function useDaySummary() {
  return useQuery<DaySummaryResponse>({
    queryKey: qk.daySummary,
    queryFn: getDaySummary,
  });
}

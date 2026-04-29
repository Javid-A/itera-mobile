import { useQuery } from "@tanstack/react-query";
import { getMissionHistory } from "../../api/missions";
import { qk } from "../queryKeys";
import type { HistoryItem } from "../../types/HistoryItem";

export function useMissionHistory() {
  return useQuery<HistoryItem[]>({
    queryKey: qk.missionHistory,
    queryFn: getMissionHistory,
  });
}

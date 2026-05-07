import { type InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { getMissionHistory } from "../../api/missions";
import { qk } from "../queryKeys";
import type { HistoryPage } from "../../types/HistoryItem";

const FIRST_PAGE_LIMIT = 50;
const NEXT_PAGE_LIMIT = 30;

export function useMissionHistory() {
  const queryClient = useQueryClient();

  return useInfiniteQuery<
    HistoryPage,
    Error,
    InfiniteData<HistoryPage, string | null>,
    typeof qk.missionHistory,
    string | null
  >({
    queryKey: qk.missionHistory,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      try {
        return await getMissionHistory({
          cursor: pageParam,
          limit: pageParam == null ? FIRST_PAGE_LIMIT : NEXT_PAGE_LIMIT,
        });
      } catch (err) {
        // Invalid/expired cursor → reset cache so next render restarts from page 1.
        if (
          pageParam != null &&
          axios.isAxiosError(err) &&
          err.response?.status === 400
        ) {
          queryClient.resetQueries({ queryKey: qk.missionHistory });
        }
        throw err;
      }
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

import { QueryClient } from "@tanstack/react-query";

// Tek QueryClient singleton — tüm app aynı cache üzerinde çalışır.
// staleTime 30s: 8b'deki mutation invalidation'lar arası ekran odaklamada
// gereksiz refetch'i engeller; refetchOnReconnect ağ döndüğünde tazelik için açık.
// Mutation retry kapalı: çift submit (örn. arriveMission) riskini önler.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

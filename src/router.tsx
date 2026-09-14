import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache media data so revisiting pages is instant instead of
        // re-hitting the media server every time.
        staleTime: 5 * 60 * 1000, // 5 min: data counts as fresh
        gcTime: 30 * 60 * 1000, // 30 min: keep in memory
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

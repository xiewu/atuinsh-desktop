import { QueryClient } from "@tanstack/react-query";
import { StateCreator } from "zustand";

export interface AtuinQueryState {
  queryClient: QueryClient;
}

export const persistQueryKeys: (keyof AtuinQueryState)[] = [];

export const createQueryState: StateCreator<AtuinQueryState> = (_set, _get, _store): AtuinQueryState => ({
  queryClient: new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 1000 * 60 * 5,
      },
    },
  }),
});

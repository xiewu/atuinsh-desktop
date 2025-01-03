// Include this in query options for queries that don't require network access
export const localQuery = {
  gcTime: 0,
  networkMode: "always",
} as const;

import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useEntityPage(entity, query = {}, options = {}) {
  const client = useQueryClient();
  useEffect(() => base44.entities[entity].subscribe(() => client.invalidateQueries({ queryKey: [entity] })), [client, entity]);
  const result = useInfiniteQuery({
    queryKey: [entity, "pages", query, options], initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities[entity].filter(query, { sort: "-created_date", limit: 25, ...options, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (page) => page.has_more ? page.next_cursor : undefined,
    staleTime: 30_000,
  });
  return { ...result, records: result.data?.pages.flatMap((page) => page.items) || [] };
}
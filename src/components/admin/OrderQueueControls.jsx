import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getOrderQueue } from "@/lib/admin-operations-fns";
import { Button } from "@/components/ui/button";

export function useOrderQueue(queue, queryKey) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const result = useInfiniteQuery({
    queryKey: [queryKey, term],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getOrderQueue({ data: { queue, search: term, offset: pageParam } }),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  return {
    ...result, search, setSearch, total: result.data?.pages[0]?.total,
    orders: result.data?.pages.flatMap((page) => page.items) ?? [],
  };
}

export function OrderQueueSearch({ queue }) {
  return <label className="mt-4 block max-w-sm text-xs text-muted-foreground">
    Buscar por número, nome ou telefone
    <input type="search" maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
      value={queue.search} onChange={(event) => queue.setSearch(event.target.value)} />
  </label>;
}

export function OrderQueueFooter({ queue }) {
  if (queue.isError) return <Button className="mt-3" variant="outline" onClick={() => queue.refetch()}>Tentar carregar novamente</Button>;
  return <div className="mt-4 flex flex-wrap items-center gap-3">
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {queue.isPending ? "Carregando pedidos…" : `${queue.orders.length} de ${queue.total} pedidos`}
    </p>
    {queue.hasNextPage && <Button variant="outline" disabled={queue.isFetchingNextPage} onClick={() => queue.fetchNextPage()}>
      {queue.isFetchingNextPage ? "Carregando…" : "Carregar mais pedidos"}
    </Button>}
  </div>;
}

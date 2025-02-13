import { getQueryClient } from "@/lib/get-query-client";
import { containerStatsQuery } from "@/lib/queries";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import StatsDisplay from "../components/stats-display";

export default async function Home() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(containerStatsQuery);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StatsDisplay />
    </HydrationBoundary>
  );
}

import { getQueryClient } from "@/lib/get-query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import StatsDisplay from "../components/stats-display";
import {
  containerStatsBetweenDatesQuery,
  containerStatsQuery,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import client from "@/utils/pb.server";
import { TimeRangeSelector } from "@/components/time-range-selector";

export default async function Home() {
  const pb = await client();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(containerStatsQuery(pb));
  await queryClient.prefetchQuery(
    containerStatsBetweenDatesQuery(
      pb,
      new Date("2025-02-13T17:00:05Z"),
      new Date("2025-02-13T17:30:31Z")
    )
  );

  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TimeRangeSelector use24HourTime={true} />
      <StatsDisplay session={session} />
    </HydrationBoundary>
  );
}

import { getQueryClient } from "@/lib/get-query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import StatsDisplay from "../components/stats-display";
import { containerStatsQuery } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import client from "@/utils/pb.server";

export default async function Home() {
  const pb = await client();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(containerStatsQuery(pb));

  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StatsDisplay session={session} />
    </HydrationBoundary>
  );
}

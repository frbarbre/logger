import { TimeRangeSelector } from "@/components/time-range-selector";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { containerStatsBetweenDatesQuery } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import client from "@/utils/pb.server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import StatsDisplay from "../../components/stats-display";
import { Session } from "@/types";

type Props = {
  searchParams: Promise<{ start: string; end: string }>;
};

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const key = `${sp.start}-${sp.end}`;

  return (
    <Suspense key={key} fallback={<div>Loading...</div>}>
      <Content session={session} sp={sp} />
    </Suspense>
  );
}

async function Content({
  session,
  sp,
}: {
  session: Session;
  sp: Awaited<Props["searchParams"]>;
}) {
  const startTime = new Date(decodeURIComponent(sp.start));
  const endTime = new Date(decodeURIComponent(sp.end));

  const pb = await client();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    containerStatsBetweenDatesQuery(
      pb,
      formatDate(startTime),
      formatDate(endTime)
    )
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TimeRangeSelector use24HourTime={true} />
      <StatsDisplay session={session} />
    </HydrationBoundary>
  );
}

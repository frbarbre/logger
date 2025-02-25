"use client";

import { containerStatsBetweenDatesQuery } from "@/lib/queries";
import { Session } from "@/types";
import client from "@/utils/pb.client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function StatsDisplay({ session }: { session: Session }) {
  const pb = client(session);
  const searchParams = useSearchParams();

  const startTime = searchParams.get("start");
  const endTime = searchParams.get("end");

  const {
    data = [],
    refetch,
    isLoading,
  } = useQuery(containerStatsBetweenDatesQuery(pb, startTime, endTime));

  useEffect(() => {
    pb.collection("stats_realtime").subscribe("*", async () => {
      await refetch();
    });

    return () => {
      pb.collection("stats_realtime").unsubscribe();
    };
  }, [refetch]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex gap-4">
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

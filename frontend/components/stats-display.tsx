"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  containerStatsBetweenDatesQuery,
  containerStatsQuery,
} from "@/lib/queries";
import client from "@/utils/pb.client";
import { Session } from "@/types";

export default function StatsDisplay({ session }: { session: Session }) {
  const pb = client(session);

  const { data = [], refetch } = useQuery(
    containerStatsBetweenDatesQuery(
      pb,
      new Date("2025-02-13T17:00:05Z"),
      new Date("2025-02-13T17:30:31Z")
    )
  );

  useEffect(() => {
    // Subscribe to realtime updates
    pb.collection("container_stats").subscribe("*", async () => {
      // Refetch the data when we receive an update
      await refetch();
    });

    return () => {
      pb.collection("container_stats").unsubscribe();
    };
  }, [refetch]);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

"use client";

import { containerStatsQuery } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

export default function StatsDisplay() {
  const { data = [], refetch } = useQuery(containerStatsQuery);

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

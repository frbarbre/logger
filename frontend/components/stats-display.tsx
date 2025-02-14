"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { containerStatsQuery } from "@/lib/queries";
import client from "@/utils/pb.client";
import { Session } from "@/types";

export default function StatsDisplay({ session }: { session: Session }) {
  const pb = client(session);

  const { data = [], refetch } = useQuery(containerStatsQuery(pb));

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

"use client";

import { useQuery } from "@tanstack/react-query";
import PocketBase from "pocketbase";
import { useEffect } from "react";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

export default function Home() {
  const { data = [], refetch } = useQuery({
    queryKey: ["container-stats"],
    queryFn: async () => {
      const records = (
        await pb.collection("container_stats").getFullList()
      ).sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return records;
    },
    initialData: [],
  });

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

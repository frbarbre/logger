"use client";

import Pocketbase from "pocketbase";
import { useEffect, useState } from "react";

export default function Home() {
  const [stats, setStats] = useState<any>([]);

  useEffect(() => {
    const pb = new Pocketbase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    pb.collection("container_stats").subscribe("*", (event) => {
      console.log(event);
      setStats((prev: any) => [...prev, event.record]);
    });
  }, []);

  return <pre>{JSON.stringify(stats, null, 2)}</pre>;
}

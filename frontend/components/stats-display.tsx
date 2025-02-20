"use client";

import { containerStatsBetweenDatesQuery } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { Session } from "@/types";
import client from "@/utils/pb.client";
import { useQuery } from "@tanstack/react-query";
import { groupBy } from "lodash";
import { useSearchParams } from "next/navigation";
import { RecordModel } from "pocketbase";
import { useEffect } from "react";

interface TimeSeriesPoint {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  memory_usage: number;
  memory_limit: number;
  block_io_in: number;
  block_io_out: number;
  net_io_in: number;
  net_io_out: number;
  pids: number;
}

const TARGET_DATA_POINTS = 100;

function calculateOptimalInterval(
  startTime: string | null,
  endTime: string | null
): number {
  if (!startTime || !endTime) return 15;

  const start = new Date(formatDate(startTime) || "").getTime();
  const end = new Date(formatDate(endTime) || "").getTime();
  const totalTimeInSeconds = (end - start) / 1000;

  let interval = Math.ceil(totalTimeInSeconds / TARGET_DATA_POINTS);

  const MIN_INTERVAL = 5;
  const MAX_INTERVAL = 3600;

  interval = Math.max(MIN_INTERVAL, Math.min(interval, MAX_INTERVAL));

  return interval;
}

function processDataPoints(
  points: RecordModel[],
  startTime: string,
  endTime: string,
  intervalSeconds: number
): TimeSeriesPoint[] {
  const intervals: TimeSeriesPoint[] = [];
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  const pointsByTime = new Map();
  points.forEach((point) => {
    const time = new Date(point.timestamp).getTime();
    const intervalTime =
      start +
      Math.round((time - start) / (intervalSeconds * 1000)) *
        (intervalSeconds * 1000);
    pointsByTime.set(intervalTime, point);
  });

  for (let time = start; time <= end; time += intervalSeconds * 1000) {
    const point = pointsByTime.get(time);
    intervals.push({
      timestamp: new Date(time).toISOString(),
      cpu_percent: point?.cpu_percent ?? 0,
      memory_percent: point?.memory_percent ?? 0,
      memory_usage: point?.memory_usage ?? 0,
      memory_limit: point?.memory_limit ?? 0,
      block_io_in: point?.block_io_in ?? 0,
      block_io_out: point?.block_io_out ?? 0,
      net_io_in: point?.net_io_in ?? 0,
      net_io_out: point?.net_io_out ?? 0,
      pids: point?.pids ?? 0,
    });
  }

  return intervals;
}

function aggregateData(
  data: RecordModel[],
  startTime: string,
  endTime: string,
  intervalSeconds: number
): Map<string, TimeSeriesPoint[]> {
  const timeSeriesData = new Map<string, TimeSeriesPoint[]>();

  // Group by name instead of container_name
  const containerGroups = groupBy(data, "name");

  // Process each container's data points
  for (const [containerName, points] of Object.entries(containerGroups)) {
    if (!containerName) continue;

    const processedPoints = processDataPoints(
      points.map((p) => ({
        ...p,
        timestamp: p.timestamp.replace(" ", "T"),
      })),
      formatDate(startTime) || "",
      formatDate(endTime) || "",
      intervalSeconds
    );

    if (processedPoints.length > 0) {
      timeSeriesData.set(containerName, processedPoints);
    }
  }

  return timeSeriesData;
}

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
    pb.collection("container_stats").subscribe("*", async () => {
      await refetch();
    });

    return () => {
      pb.collection("container_stats").unsubscribe();
    };
  }, [refetch]);

  const intervalSeconds = calculateOptimalInterval(startTime, endTime);

  const aggregatedData = data
    ? aggregateData(
        data,
        formatDate(startTime) || "",
        formatDate(endTime) || "",
        intervalSeconds
      )
    : new Map();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex gap-4">
      {[...aggregatedData].map(([key, value]) => (
        <pre key={key}>{JSON.stringify({ [key]: value }, null, 2)}</pre>
      ))}
    </div>
  );
}

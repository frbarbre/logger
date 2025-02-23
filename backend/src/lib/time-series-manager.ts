import {
  TimeSeriesConfig,
  TimeWindow,
  TimeSeriesPoint,
  ContainerStats,
} from "../types/index.js";
import PocketBase from "../../node_modules/pocketbase/dist/pocketbase.es.mjs";
import { average } from "../utils.js";

export const TIME_SERIES_CONFIGS: TimeSeriesConfig[] = [
  {
    id: "stats_realtime",
    name: "stats_realtime",
    retention: "1h",
    resolution: "10s",
    until: "1h",
  },
  {
    id: "stats_5m",
    name: "stats_5m",
    retention: "6h",
    resolution: "5m",
    startFrom: "1h",
    until: "3h",
  },
  {
    id: "stats_10m",
    name: "stats_10m",
    retention: "6h",
    resolution: "10m",
    startFrom: "3h",
    until: "6h",
  },
  {
    id: "stats_15m",
    name: "stats_15m",
    retention: "12h",
    resolution: "15m",
    startFrom: "6h",
    until: "12h",
  },
  {
    id: "stats_30m",
    name: "stats_30m",
    retention: "24h",
    resolution: "30m",
    startFrom: "12h",
    until: "24h",
  },
  {
    id: "stats_1h",
    name: "stats_1h",
    retention: "48h",
    resolution: "1h",
    startFrom: "24h",
    until: "48h",
  },
  {
    id: "stats_3h",
    name: "stats_3h",
    retention: "96h",
    resolution: "3h",
    startFrom: "48h",
    until: "96h",
  },
  {
    id: "stats_6h",
    name: "stats_6h",
    retention: "7d",
    resolution: "6h",
    startFrom: "96h",
    until: "7d",
  },
  {
    id: "stats_9h",
    name: "stats_9h",
    retention: "14d",
    resolution: "9h",
    startFrom: "7d",
    until: "14d",
  },
  {
    id: "stats_12h",
    name: "stats_12h",
    retention: "30d",
    resolution: "12h",
    startFrom: "14d",
    until: "30d",
  },
];

export class TimeSeriesManager {
  constructor(private pb: PocketBase) {}

  private parseTimeValue(value: string): number {
    const num = parseInt(value);
    if (value.endsWith("s")) return num * 1000;
    if (value.endsWith("m")) return num * 60 * 1000;
    if (value.endsWith("h")) return num * 60 * 60 * 1000;
    if (value.endsWith("d")) return num * 24 * 60 * 60 * 1000;
    return num;
  }

  private shouldAggregateForResolution(
    timestamp: Date,
    resolution: string
  ): boolean {
    const resolutionMs = this.parseTimeValue(resolution);
    const timestampMs = timestamp.getTime();
    return timestampMs % resolutionMs < 1000; // Allow 1 second tolerance
  }

  private getAggregationWindow(
    timestamp: Date,
    config: TimeSeriesConfig
  ): TimeWindow {
    const resolutionMs = this.parseTimeValue(config.resolution);
    const end = new Date(
      Math.floor(timestamp.getTime() / resolutionMs) * resolutionMs
    );
    const start = new Date(end.getTime() - resolutionMs);
    return { start, end };
  }

  private async fetchSourceData(
    window: TimeWindow,
    sourceConfig: TimeSeriesConfig
  ): Promise<TimeSeriesPoint[]> {
    const start = window.start.toISOString().slice(0, -1) + ".000Z";
    const end = window.end.toISOString().slice(0, -1) + ".000Z";

    const records = await this.pb.collection(sourceConfig.id).getList(1, 1000, {
      filter: `timestamp >= "${start}" && timestamp <= "${end}"`,
      sort: "timestamp",
    });

    return records.items.map((record) => ({
      timestamp: new Date(record.timestamp),
      containers: record.containers,
    }));
  }

  private aggregateContainerStats(stats: ContainerStats[]): ContainerStats {
    return {
      name: stats[0].name,
      cpu_percent: average(stats.map((s) => s.cpu_percent)),
      memory_usage: average(stats.map((s) => s.memory_usage)),
      memory_limit: stats[0].memory_limit, // This should be constant
      memory_percent: average(stats.map((s) => s.memory_percent)),
      net_io_in: average(stats.map((s) => s.net_io_in)),
      net_io_out: average(stats.map((s) => s.net_io_out)),
      block_io_in: average(stats.map((s) => s.block_io_in)),
      block_io_out: average(stats.map((s) => s.block_io_out)),
      pids: Math.round(average(stats.map((s) => s.pids))),
    };
  }

  private aggregateData(
    sourceData: TimeSeriesPoint[],
    resolution: string
  ): TimeSeriesPoint {
    const containerIds = new Set<string>();
    sourceData.forEach((point) => {
      Object.keys(point.containers).forEach((id) => containerIds.add(id));
    });

    const containers: { [id: string]: ContainerStats } = {};

    for (const containerId of containerIds) {
      const containerStats = sourceData
        .filter((point) => point.containers[containerId])
        .map((point) => point.containers[containerId]);

      if (containerStats.length > 0) {
        containers[containerId] = this.aggregateContainerStats(containerStats);
      }
    }

    return {
      timestamp: sourceData[sourceData.length - 1].timestamp,
      containers,
      metadata: {
        resolution,
        aggregationType: "average",
      },
    };
  }

  private async storeAggregatedData(
    collectionId: string,
    timestamp: Date,
    newData: TimeSeriesPoint
  ) {
    try {
      const formattedTimestamp = timestamp.toISOString().replace("T", " ");

      // Check if a record already exists for this timestamp
      const existing = await this.pb
        .collection(collectionId)
        .getFirstListItem(`timestamp = '${formattedTimestamp}'`)
        .catch(() => null);

      if (existing) {
        // Update existing record with new running average
        const oldCount = existing.metadata?.count || 1;
        const newCount = oldCount + 1;

        const mergedContainers: { [id: string]: ContainerStats } = {};
        const allContainerIds = new Set([
          ...Object.keys(existing.containers),
          ...Object.keys(newData.containers),
        ]);

        for (const id of allContainerIds) {
          const oldStats = existing.containers[id];
          const newStats = newData.containers[id];

          if (oldStats && newStats) {
            // Calculate running average
            mergedContainers[id] = {
              name: newStats.name,
              cpu_percent:
                (oldStats.cpu_percent * oldCount + newStats.cpu_percent) /
                newCount,
              memory_usage:
                (oldStats.memory_usage * oldCount + newStats.memory_usage) /
                newCount,
              memory_limit: newStats.memory_limit,
              memory_percent:
                (oldStats.memory_percent * oldCount + newStats.memory_percent) /
                newCount,
              net_io_in:
                (oldStats.net_io_in * oldCount + newStats.net_io_in) / newCount,
              net_io_out:
                (oldStats.net_io_out * oldCount + newStats.net_io_out) /
                newCount,
              block_io_in:
                (oldStats.block_io_in * oldCount + newStats.block_io_in) /
                newCount,
              block_io_out:
                (oldStats.block_io_out * oldCount + newStats.block_io_out) /
                newCount,
              pids: Math.round(
                (oldStats.pids * oldCount + newStats.pids) / newCount
              ),
            };
          } else {
            mergedContainers[id] = oldStats || newStats;
          }
        }

        await this.pb.collection(collectionId).update(existing.id, {
          containers: mergedContainers,
          metadata: {
            ...newData.metadata,
            count: newCount,
          },
        });
      } else {
        // Create new record
        await this.pb.collection(collectionId).create({
          timestamp: formattedTimestamp,
          containers: newData.containers,
          metadata: {
            ...newData.metadata,
            count: 1,
          },
        });
      }
    } catch (error) {
      console.error("Full error details:", error);
      throw error;
    }
  }

  private async moveAndAggregateOutdatedRecords(
    sourceConfig: TimeSeriesConfig,
    config: TimeSeriesConfig
  ) {
    // Calculate the retention window for this collection
    const now = Date.now();
    const retentionStart = now - this.parseTimeValue(config.retention);
    const retentionEnd = config.startFrom
      ? now - this.parseTimeValue(config.startFrom)
      : now;

    // Find records in source collection that fall within this collection's window
    const records = await this.pb.collection(sourceConfig.id).getList(1, 1000, {
      filter: `timestamp >= '${new Date(retentionStart)
        .toISOString()
        .replace("T", " ")}' && timestamp < '${new Date(retentionEnd)
        .toISOString()
        .replace("T", " ")}'`,
      sort: "timestamp",
    });

    if (records.items.length === 0) return;

    // Group records by their target aggregation window
    const resolutionMs = this.parseTimeValue(config.resolution);
    const recordsByWindow = new Map<number, TimeSeriesPoint[]>();

    records.items.forEach((record) => {
      const recordTime = new Date(record.timestamp).getTime();
      const windowStart = Math.floor(recordTime / resolutionMs) * resolutionMs;

      if (!recordsByWindow.has(windowStart)) {
        recordsByWindow.set(windowStart, []);
      }
      recordsByWindow.get(windowStart)?.push({
        timestamp: new Date(record.timestamp),
        containers: record.containers,
        metadata: record.metadata,
      });
    });

    // Aggregate and store records in target collection
    for (const [windowStart, windowRecords] of recordsByWindow) {
      const aggregatedData = this.aggregateData(
        windowRecords,
        config.resolution
      );

      try {
        await this.storeAggregatedData(
          config.id,
          new Date(windowStart),
          aggregatedData
        );

        // Delete the processed records from source collection
        for (const record of windowRecords) {
          if (record.id) {
            await this.pb.collection(sourceConfig.id).delete(record.id);
          }
        }

        console.log(
          `Moved and aggregated ${windowRecords.length} records from ${sourceConfig.id} to ${config.id}`
        );
      } catch (error) {
        console.error(`Error processing records for ${config.id}:`, error);
      }
    }

    // After processing all records, cleanup any duplicates or out-of-window records
    try {
      const records = await this.pb.collection(config.id).getFullList({
        filter: `timestamp >= '${new Date(retentionStart)
          .toISOString()
          .replace("T", " ")}' && timestamp < '${new Date(retentionEnd)
          .toISOString()
          .replace("T", " ")}'`,
        sort: "timestamp",
      });

      const seenWindows = new Set<number>();
      for (const record of records) {
        const recordTime = new Date(record.timestamp).getTime();
        const windowStart =
          Math.floor(recordTime / resolutionMs) * resolutionMs;

        if (seenWindows.has(windowStart)) {
          // Delete duplicate timestamps
          await this.pb.collection(config.id).delete(record.id);
        } else {
          seenWindows.add(windowStart);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up records for ${config.id}:`, error);
    }
  }

  async aggregateStats(timestamp: Date) {
    try {
      for (const config of TIME_SERIES_CONFIGS) {
        if (config.id === "stats_realtime") continue;

        const sourceConfig = TIME_SERIES_CONFIGS.find(
          (c) =>
            this.parseTimeValue(c.until || "Infinity") ===
            this.parseTimeValue(config.startFrom || "0")
        );

        if (!sourceConfig) continue;

        await this.moveAndAggregateOutdatedRecords(sourceConfig, config);
      }
    } catch (error) {
      console.error("Error in aggregation cycle:", error);
    }
  }

  selectAppropriateConfig(timeRange: TimeWindow): TimeSeriesConfig {
    const rangeInMs = timeRange.end.getTime() - timeRange.start.getTime();

    for (const config of TIME_SERIES_CONFIGS) {
      const startFromMs = config.startFrom
        ? this.parseTimeValue(config.startFrom)
        : 0;
      const untilMs = config.until
        ? this.parseTimeValue(config.until)
        : Infinity;

      if (rangeInMs >= startFromMs && rangeInMs < untilMs) {
        return config;
      }
    }

    return TIME_SERIES_CONFIGS[TIME_SERIES_CONFIGS.length - 1];
  }

  async getContainerStats(timeRange: TimeWindow): Promise<TimeSeriesPoint[]> {
    const now = Date.now();
    const queryRanges: Array<{
      collection: string;
      start: Date;
      end: Date;
    }> = [];

    // Find all applicable time ranges and their corresponding collections
    for (const config of TIME_SERIES_CONFIGS) {
      const startFromMs = config.startFrom
        ? this.parseTimeValue(config.startFrom)
        : 0;
      const untilMs = config.until
        ? this.parseTimeValue(config.until)
        : Infinity;

      // Calculate the time window for this resolution
      const windowStart = new Date(now - untilMs);
      const windowEnd = new Date(now - startFromMs);

      // Check if this resolution's window overlaps with the requested time range
      const rangeStart = new Date(
        Math.max(timeRange.start.getTime(), windowStart.getTime())
      );
      const rangeEnd = new Date(
        Math.min(timeRange.end.getTime(), windowEnd.getTime())
      );

      if (rangeStart < rangeEnd) {
        queryRanges.push({
          collection: config.id,
          start: rangeStart,
          end: rangeEnd,
        });
      }
    }

    // Sort ranges by start time to ensure proper ordering
    queryRanges.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Query data from all relevant collections
    const dataPromises = queryRanges.map((range) => {
      const start = range.start.toISOString().slice(0, -1) + ".000Z";
      const end = range.end.toISOString().slice(0, -1) + ".000Z";

      return this.pb.collection(range.collection).getList(1, 1000, {
        sort: "-timestamp",
        filter: `timestamp >= "${start}" && timestamp <= "${end}"`,
      });
    });

    const results = await Promise.all(dataPromises);

    // Merge all results and sort by timestamp
    const allPoints = results.flatMap((result) =>
      result.items.map((record) => ({
        timestamp: new Date(record.timestamp),
        containers: record.containers,
        metadata: record.metadata,
      }))
    );

    // Sort by timestamp to ensure proper ordering
    return allPoints.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  async cleanupOldData() {
    for (const config of TIME_SERIES_CONFIGS) {
      const retentionMs = this.parseTimeValue(config.retention);
      const cutoff = new Date(Date.now() - retentionMs);

      await this.pb
        .collection(config.id)
        .delete(`timestamp < '${cutoff.toISOString()}'`);
    }
  }
}

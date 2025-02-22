import {
  TimeSeriesConfig,
  TimeWindow,
  TimeSeriesPoint,
  ContainerStats,
} from "../types/index.js";
import PocketBase from "pocketbase";
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
    id: "stats_10m",
    name: "stats_10m",
    retention: "6h",
    resolution: "10m",
    startFrom: "1h",
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
    return timestamp.getTime() % resolutionMs === 0;
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
    const records = await this.pb.collection(sourceConfig.id).getList(1, 1000, {
      filter: `timestamp >= '${window.start.toISOString()}' && timestamp < '${window.end.toISOString()}'`,
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
    data: TimeSeriesPoint
  ) {
    await this.pb.collection(collectionId).create({
      timestamp: timestamp.toISOString(),
      containers: data.containers,
      metadata: data.metadata,
    });
  }

  async aggregateStats(timestamp: Date) {
    for (const config of TIME_SERIES_CONFIGS) {
      if (config.id === "stats_realtime") continue;

      if (this.shouldAggregateForResolution(timestamp, config.resolution)) {
        const window = this.getAggregationWindow(timestamp, config);
        const sourceConfig = this.getSourceConfigForAggregation(config);

        if (sourceConfig) {
          const sourceData = await this.fetchSourceData(window, sourceConfig);
          if (sourceData.length > 0) {
            const aggregatedData = this.aggregateData(
              sourceData,
              config.resolution
            );
            await this.storeAggregatedData(
              config.id,
              timestamp,
              aggregatedData
            );
          }
        }
      }
    }
  }

  private getSourceConfigForAggregation(
    targetConfig: TimeSeriesConfig
  ): TimeSeriesConfig | null {
    const targetStartMs = this.parseTimeValue(targetConfig.startFrom || "0");

    // Find the config that covers the period just before this one
    return (
      TIME_SERIES_CONFIGS.find((config) => {
        const configUntilMs = this.parseTimeValue(config.until || "Infinity");
        return configUntilMs === targetStartMs;
      }) || null
    );
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
    const config = this.selectAppropriateConfig(timeRange);

    const records = await this.pb.collection(config.id).getList(1, 1000, {
      filter: `timestamp >= '${timeRange.start.toISOString()}' && timestamp <= '${timeRange.end.toISOString()}'`,
      sort: "timestamp",
    });

    return records.items.map((record) => ({
      timestamp: new Date(record.timestamp),
      containers: record.containers,
      metadata: record.metadata,
    }));
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

import {
  TimeSeriesConfig,
  TimeWindow,
  TimeSeriesPoint,
  ContainerStats,
} from "../types/index.js";
import PocketBase from "../../node_modules/pocketbase/dist/pocketbase.es.mjs";
import { average } from "../utils.js";
import debug from "debug";
import { TIME_SCALE_FACTOR, TIME_SERIES_CONFIGS } from "../contants/index.js";

// Create namespaced debuggers
const logConfig = debug("timeseries:config");
const logAggregation = debug("timeseries:aggregation");
const logStorage = debug("timeseries:storage");
const logQuery = debug("timeseries:query");
const logError = debug("timeseries:error");

export class TimeSeriesManager {
  constructor(private pb: PocketBase) {
    logConfig(
      "Initializing TimeSeriesManager with TIME_SCALE_FACTOR:",
      TIME_SCALE_FACTOR
    );
  }

  private parseTimeValue(value?: string): number {
    if (!value) return 0;

    // Læs numerisk del som float
    const numericPart = parseFloat(value);
    let ms = 0;

    if (value.endsWith("s")) {
      ms = numericPart * 1000;
    } else if (value.endsWith("m")) {
      ms = numericPart * 60 * 1000;
    } else if (value.endsWith("h")) {
      ms = numericPart * 60 * 60 * 1000;
    } else if (value.endsWith("d")) {
      ms = numericPart * 24 * 60 * 60 * 1000;
    }

    // Skaler millisekunder
    const scaledMs = ms * TIME_SCALE_FACTOR;

    // Log til debugging
    logConfig("Parsed time value:", {
      original: value,
      numericPart,
      unit: value.slice(-1),
      unscaledMs: ms,
      scaledMs,
    });

    return scaledMs;
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
    const formattedTimestamp = timestamp.toISOString().replace("T", " ");

    logStorage("Attempting to store aggregated data:", {
      collectionId,
      timestamp: formattedTimestamp,
      containerCount: Object.keys(newData.containers).length,
    });

    try {
      const existing = await this.pb
        .collection(collectionId)
        .getFirstListItem(`timestamp = '${formattedTimestamp}'`)
        .catch(() => null);

      if (existing) {
        logStorage("Updating existing record:", {
          collectionId,
          recordId: existing.id,
          oldCount: existing.metadata?.count || 1,
        });
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
        logStorage("Creating new record:", {
          collectionId,
          timestamp: formattedTimestamp,
        });
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
      logError("Error in storeAggregatedData:", {
        collectionId,
        timestamp: formattedTimestamp,
        error,
      });
      throw error;
    }
  }

  private async moveAndAggregateOutdatedRecords(
    sourceConfig: TimeSeriesConfig,
    config: TimeSeriesConfig
  ) {
    const now = Date.now();

    // Calculate proper window for outdated records
    const retentionPeriod = this.parseTimeValue(config.retention);
    const startFromPeriod = this.parseTimeValue(config.startFrom || "0");

    // Calculate window with non-zero duration - ensure we have a reasonable window
    const windowEnd = now - startFromPeriod;
    const windowStart = config.startFrom
      ? now - retentionPeriod
      : windowEnd - this.parseTimeValue(sourceConfig.resolution) * 10; // At least 10 resolution periods

    const startDate = new Date(windowStart).toISOString().replace("T", " ");
    const endDate = new Date(windowEnd).toISOString().replace("T", " ");

    logAggregation("Aggregation window calculation:", {
      sourceConfig: sourceConfig.id,
      targetConfig: config.id,
      windowStart,
      windowEnd,
      start: startDate,
      end: endDate,
      now: new Date(now).toISOString().replace("T", " "),
    });

    try {
      // Find records from source that are in our aggregation window
      const sourceRecords = await this.pb
        .collection(sourceConfig.id)
        .getFullList({
          filter: `timestamp >= '${startDate}' && timestamp < '${endDate}'`,
          sort: "timestamp",
        });

      logQuery("Found records:", {
        sourceConfig: sourceConfig.id,
        count: sourceRecords.length,
        timeRange: { start: startDate, end: endDate },
      });

      if (sourceRecords.length === 0) {
        logQuery("No records to aggregate");
        return;
      }

      // Group records by their target aggregation window
      const resolutionMs = this.parseTimeValue(config.resolution);
      logAggregation("Grouping records by resolution:", {
        resolution: config.resolution,
        resolutionMs,
      });

      const recordsByWindow = new Map<number, TimeSeriesPoint[]>();
      const recordIdsByWindow = new Map<number, string[]>(); // Track record IDs for later deletion

      sourceRecords.forEach((record) => {
        const recordTime = new Date(record.timestamp).getTime();
        const windowStart =
          Math.floor(recordTime / resolutionMs) * resolutionMs;

        if (!recordsByWindow.has(windowStart)) {
          recordsByWindow.set(windowStart, []);
          recordIdsByWindow.set(windowStart, []);
        }
        recordsByWindow.get(windowStart)?.push({
          timestamp: new Date(record.timestamp),
          containers: record.containers,
          metadata: record.metadata,
        });

        if (record.id) {
          recordIdsByWindow.get(windowStart)?.push(record.id);
        }
      });

      logAggregation(`Found ${recordsByWindow.size} time windows to process`);

      // Aggregate and store records in target collection
      for (const [bucketStart, windowRecords] of recordsByWindow) {
        const bucketTimestamp = new Date(bucketStart);
        const recordIds = recordIdsByWindow.get(bucketStart) || [];

        const aggregatedData = this.aggregateData(
          windowRecords,
          config.resolution
        );

        try {
          await this.storeAggregatedData(
            config.id,
            bucketTimestamp,
            aggregatedData
          );

          // Delete the processed records from source collection
          logAggregation(
            `Deleting ${recordIds.length} processed records from ${sourceConfig.id}`
          );

          // Delete in batches to avoid overwhelming the database
          const batchSize = 50;
          for (let i = 0; i < recordIds.length; i += batchSize) {
            const batch = recordIds.slice(i, i + batchSize);
            await Promise.all(
              batch.map((id) =>
                this.pb
                  .collection(sourceConfig.id)
                  .delete(id)
                  .catch((err) => {
                    logError(
                      `Failed to delete record ${id} from ${sourceConfig.id}:`,
                      err
                    );
                  })
              )
            );
          }

          logAggregation(
            `Moved and aggregated ${windowRecords.length} records from ${sourceConfig.id} to ${config.id}`
          );
        } catch (error) {
          logError(`Error processing records for ${config.id}:`, error);
        }
      }

      // After processing all records, cleanup duplicates or out-of-window records
      try {
        const retentionStart = now - this.parseTimeValue(config.retention);
        const retentionEnd = now - this.parseTimeValue(config.startFrom || "0");

        // Make sure we're not deleting records we need for aggregation
        if (retentionStart < retentionEnd) {
          const oldRecords = await this.pb.collection(config.id).getFullList({
            filter: `timestamp >= '${new Date(retentionStart)
              .toISOString()
              .replace("T", " ")}' && timestamp < '${new Date(retentionEnd)
              .toISOString()
              .replace("T", " ")}'`,
            sort: "timestamp",
          });

          const seenWindows = new Set<number>();
          const duplicateRecords: string[] = [];

          for (const rec of oldRecords) {
            const recordTime = new Date(rec.timestamp).getTime();
            const windowStart =
              Math.floor(recordTime / resolutionMs) * resolutionMs;

            if (seenWindows.has(windowStart)) {
              // Delete duplicate timestamps
              duplicateRecords.push(rec.id);
            } else {
              seenWindows.add(windowStart);
            }
          }

          if (duplicateRecords.length > 0) {
            logStorage(
              `Deleting ${duplicateRecords.length} duplicate records from ${config.id}`
            );

            const batchSize = 50;
            for (let i = 0; i < duplicateRecords.length; i += batchSize) {
              const batch = duplicateRecords.slice(i, i + batchSize);
              await Promise.all(
                batch.map((id) =>
                  this.pb
                    .collection(config.id)
                    .delete(id)
                    .catch((err) => {
                      logError(
                        `Failed to delete duplicate record ${id} from ${config.id}:`,
                        err
                      );
                    })
                )
              );
            }
          }
        }
      } catch (error) {
        logError(`Error cleaning up records for ${config.id}:`, error);
      }
    } catch (error) {
      logError("Error in moveAndAggregateOutdatedRecords:", {
        sourceConfig: sourceConfig.id,
        targetConfig: config.id,
        error,
      });
      throw error;
    }
  }

  async aggregateStats() {
    logAggregation("Starting aggregation cycle");
    try {
      for (const config of TIME_SERIES_CONFIGS) {
        if (config.id === "stats_realtime") continue;

        const sourceConfig = TIME_SERIES_CONFIGS.find(
          (c) =>
            this.parseTimeValue(c.until || "Infinity") ===
            this.parseTimeValue(config.startFrom || "0")
        );

        if (!sourceConfig) {
          logConfig("No source config found for:", config.id);
          continue;
        }

        logAggregation("Processing config:", {
          source: sourceConfig.id,
          target: config.id,
        });

        await this.moveAndAggregateOutdatedRecords(sourceConfig, config);
      }
    } catch (error) {
      logError("Error in aggregation cycle:", error);
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

      // Check om dette intervals vindue overlapper med det ønskede timeRange
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
      const start = range.start.toISOString().replace("T", " ");
      const end = range.end.toISOString().replace("T", " ");

      console.log(start, end);
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

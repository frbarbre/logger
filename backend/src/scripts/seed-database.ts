import { TIME_SERIES_STRUCTURE } from "../contants/index.js";
import PocketBase from "../../node_modules/pocketbase/dist/pocketbase.es.mjs";
import { ContainerStats, TimeSeriesPoint } from "../types/index.js";

// Configuration
const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://localhost:8090";
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

// Container names to generate data for
const CONTAINER_NAMES = [
  "node-app",
  "pocketbase",
  "next-app",
  "mongodb",
  "redis",
];

// Connect to PocketBase
const pb = new PocketBase(POCKETBASE_URL);

// Base stats for container
const BASE_STATS: Record<string, ContainerStats> = {
  "node-app": {
    name: "node-app",
    cpu_percent: 0.5,
    memory_usage: 70,
    memory_limit: 7.653,
    memory_percent: 0.9,
    net_io_in: 120,
    net_io_out: 250,
    block_io_in: 10,
    block_io_out: 50,
    pids: 12,
  },
  pocketbase: {
    name: "pocketbase",
    cpu_percent: 0.3,
    memory_usage: 30,
    memory_limit: 7.653,
    memory_percent: 0.4,
    net_io_in: 80,
    net_io_out: 200,
    block_io_in: 5,
    block_io_out: 15,
    pids: 8,
  },
  "next-app": {
    name: "next-app",
    cpu_percent: 0.4,
    memory_usage: 120,
    memory_limit: 7.653,
    memory_percent: 1.5,
    net_io_in: 150,
    net_io_out: 320,
    block_io_in: 8,
    block_io_out: 20,
    pids: 15,
  },
  mongodb: {
    name: "mongodb",
    cpu_percent: 0.6,
    memory_usage: 200,
    memory_limit: 7.653,
    memory_percent: 2.6,
    net_io_in: 100,
    net_io_out: 180,
    block_io_in: 30,
    block_io_out: 120,
    pids: 20,
  },
  redis: {
    name: "redis",
    cpu_percent: 0.2,
    memory_usage: 40,
    memory_limit: 7.653,
    memory_percent: 0.5,
    net_io_in: 60,
    net_io_out: 90,
    block_io_in: 2,
    block_io_out: 5,
    pids: 5,
  },
};

// Parse time values (e.g., "1h", "30m", "10s") to milliseconds
function parseTimeValue(timeValue: string): number {
  const match = timeValue.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time value: ${timeValue}`);
  }

  const [, value, unit] = match;
  const numValue = parseInt(value, 10);

  switch (unit) {
    case "s":
      return numValue * 1000;
    case "m":
      return numValue * 60 * 1000;
    case "h":
      return numValue * 60 * 60 * 1000;
    case "d":
      return numValue * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

// Parse time range (e.g., "now - 1h", "1h - 3h ago")
function parseTimeRange(
  timeRange: string,
  now: Date
): { start: Date; end: Date } {
  const nowMs = now.getTime();

  if (timeRange.startsWith("now")) {
    // Format: "now - Xh"
    const parts = timeRange.split("-").map((p) => p.trim());
    const endTime = nowMs;
    const startTime = nowMs - parseTimeValue(parts[1]);
    return {
      start: new Date(startTime),
      end: new Date(endTime),
    };
  } else {
    // Format: "Xh - Yh ago"
    const parts = timeRange.split("-").map((p) => p.trim());
    const recentTime = parts[0].replace(" ago", "");
    const olderTime = parts[1].replace(" ago", "");

    const startTime = nowMs - parseTimeValue(olderTime);
    const endTime = nowMs - parseTimeValue(recentTime);

    return {
      start: new Date(startTime),
      end: new Date(endTime),
    };
  }
}

// Generate random container stats with natural variations
function generateContainerStats(
  baseStat: ContainerStats,
  timestamp: Date
): ContainerStats {
  // Add natural variations based on time of day
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();

  // Create daily patterns (higher load during business hours)
  const timeOfDayFactor = hour >= 9 && hour <= 17 ? 1.2 : 0.8;

  // Create some hourly patterns
  const hourlyFactor = 1 + Math.sin((hour / 24) * Math.PI * 2) * 0.2;

  // Random noise component (±10%)
  const noise = () => 0.9 + Math.random() * 0.2;

  return {
    name: baseStat.name,
    cpu_percent:
      baseStat.cpu_percent * timeOfDayFactor * hourlyFactor * noise(),
    memory_usage: baseStat.memory_usage * timeOfDayFactor * noise(),
    memory_limit: baseStat.memory_limit,
    memory_percent: baseStat.memory_percent * timeOfDayFactor * noise(),
    net_io_in: baseStat.net_io_in * timeOfDayFactor * hourlyFactor * noise(),
    net_io_out: baseStat.net_io_out * timeOfDayFactor * hourlyFactor * noise(),
    block_io_in: baseStat.block_io_in * hourlyFactor * noise(),
    block_io_out: baseStat.block_io_out * hourlyFactor * noise(),
    pids: Math.max(1, Math.round(baseStat.pids * timeOfDayFactor * noise())),
  };
}

// Generate data for a specific time point
function generateTimePoint(
  timestamp: Date,
  resolution: string
): TimeSeriesPoint {
  const containers: Record<string, ContainerStats> = {};

  // Generate stats for each container
  for (const containerName of CONTAINER_NAMES) {
    const baseStats = BASE_STATS[containerName];
    if (baseStats) {
      containers[containerName] = generateContainerStats(baseStats, timestamp);
    }
  }

  return {
    timestamp,
    containers,
    metadata: {
      resolution,
      aggregationType: "average",
      count: 1,
    },
  };
}

// Seed data for a specific collection based on the time series structure
async function seedCollectionByStructure(
  bucketConfig: (typeof TIME_SERIES_STRUCTURE.timeSeriesBuckets)[0]
) {
  console.log(`Seeding collection: ${bucketConfig.id}`);
  const now = new Date();

  // Parse time range more explicitly for better alignment
  let startTime, endTime;

  if (bucketConfig.timeRange === "now - 1h") {
    // Special case for realtime stats
    endTime = new Date();
    startTime = new Date(endTime.getTime() - parseTimeValue("1h"));
  } else {
    // Parse ranges like "1h - 3h ago" or "7d - 14d ago"
    const parts = bucketConfig.timeRange.split(" - ");
    const fromTime = parts[0];
    const toTime = parts[1].replace(" ago", "");

    startTime = new Date(now.getTime() - parseTimeValue(toTime));
    endTime = new Date(now.getTime() - parseTimeValue(fromTime));
  }

  // Calculate resolution in milliseconds
  const resolutionMs = parseTimeValue(bucketConfig.resolution);

  // Round start and end times to the nearest resolution boundary
  startTime = new Date(
    Math.floor(startTime.getTime() / resolutionMs) * resolutionMs
  );
  endTime = new Date(
    Math.ceil(endTime.getTime() / resolutionMs) * resolutionMs
  );

  // Calculate points to generate based on maxRows or time span
  const totalTimeSpan = endTime.getTime() - startTime.getTime();
  const points = Math.min(
    bucketConfig.maxRows,
    Math.floor(totalTimeSpan / resolutionMs) + 1
  );

  console.log(
    `  Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`
  );
  console.log(`  Resolution: ${bucketConfig.resolution} (${resolutionMs}ms)`);
  console.log(`  Points to generate: ${points}`);

  let inserted = 0;

  for (let i = 0; i < points; i++) {
    // Calculate timestamp for this point
    const pointTime = new Date(startTime.getTime() + i * resolutionMs);

    // Format timestamp EXACTLY as the time-series-manager expects it
    const formattedTimestamp = pointTime.toISOString().replace("T", " ");

    const timePoint = generateTimePoint(pointTime, bucketConfig.resolution);

    try {
      await pb.collection(bucketConfig.id).create({
        timestamp: formattedTimestamp,
        containers: timePoint.containers,
        metadata: timePoint.metadata,
      });

      inserted++;
      if (inserted % 10 === 0 || inserted === points) {
        console.log(`  Inserted ${inserted}/${points} records...`);
      }
    } catch (error) {
      console.error(`  Error inserting record ${i}:`, (error as Error).message);
    }
  }

  console.log(
    `  Completed seeding ${bucketConfig.id}: ${inserted}/${points} records inserted`
  );
}

// Main function to seed all collections
async function seedDatabase() {
  try {
    console.log("Authenticating with PocketBase...");
    await pb.admins.authWithPassword(
      POCKETBASE_ADMIN_EMAIL as string,
      POCKETBASE_ADMIN_PASSWORD as string
    );
    console.log("Authentication successful");

    // Clear existing data
    for (const bucket of TIME_SERIES_STRUCTURE.timeSeriesBuckets) {
      console.log(`Clearing collection: ${bucket.id}`);
      try {
        const records = await pb.collection(bucket.id).getFullList();
        for (const record of records) {
          await pb.collection(bucket.id).delete(record.id);
        }
        console.log(`  Deleted ${records.length} records`);
      } catch (error) {
        console.error(`  Error clearing collection ${bucket.id}:`, error);
      }
    }

    // Seed collections in order (oldest to newest)
    for (const bucket of [...TIME_SERIES_STRUCTURE.timeSeriesBuckets]) {
      await seedCollectionByStructure(bucket);
    }

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run the seeder
seedDatabase();

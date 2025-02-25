import { exec } from "child_process";
import cors from "cors";
import express from "express";
import { TIME_SCALE_FACTOR } from "./contants/index.js";
import { TimeSeriesManager } from "./lib/time-series-manager.js";
import superuserClient from "./pocketbase.js";
import { ContainerStats } from "./types/index.js";
import { formatDockerStats } from "./utils.js";

const app = express();

const PORT = Number(process.env.PORT) || 8000;
const timeSeriesManager = new TimeSeriesManager(superuserClient);

app.use(express.json());
app.use(cors());

const collectDockerStats = (): Promise<{
  [containerId: string]: ContainerStats;
}> => {
  return new Promise((resolve) => {
    exec(
      "docker stats --no-stream --format '{{json .}}'",
      async (err, stdout, stderr) => {
        if (err || stderr) {
          console.error(err || stderr);
          resolve({});
          return;
        }

        const containerStats = stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
          .map((stat) => {
            const formatted = formatDockerStats(stat);
            return [formatted.name, formatted] as const;
          })
          .reduce<{ [key: string]: ContainerStats }>((acc, [name, stats]) => {
            acc[name] = stats;
            return acc;
          }, {});

        resolve(containerStats);
      }
    );
  });
};

// Function to test PocketBase connection
async function testPocketBaseConnection() {
  try {
    const health = await superuserClient.health.check();
    console.log("✅ PocketBase connection successful:", health);
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to PocketBase:", error);
    return false;
  }
}

let isCollecting = false;

app.get("/node-api/hello", (req, res) => {
  res.status(200).json({ message: "Hello World" });
});

// Setup routes
app.get("/node-api/stats/history", async (req, res) => {
  try {
    const start = new Date(req.query.start as string);
    const end = new Date(req.query.end as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: "Invalid date range" });
      return;
    }

    const stats = await timeSeriesManager.getContainerStats({ start, end });
    res.json(stats);
  } catch (error) {
    console.error("Error fetching historical stats:", error);
    res.status(500).json({ error: "Failed to fetch historical stats" });
  }
});

app.get("/node-api/stats/live", async (req, res) => {
  try {
    const stats = await collectDockerStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching live stats:", error);
    res.status(500).json({ error: "Failed to fetch live stats" });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is running on port ${PORT}`);

  // Test connection and authenticate
  const isConnected = await testPocketBaseConnection();

  if (!isConnected) {
    console.error("Failed to connect to PocketBase. Exiting...");
    process.exit(1);
  }

  const baseInterval = 10000; // 10 seconds
  const interval = Math.round(baseInterval * TIME_SCALE_FACTOR);

  setInterval(async () => {
    if (isCollecting) return; // Skip if already collecting
    isCollecting = true;

    try {
      const timestamp = new Date();
      const stats = await collectDockerStats();

      // Store in realtime collection
      await superuserClient.collection("stats_realtime").create({
        timestamp: timestamp.toISOString(),
        containers: stats,
        metadata: {
          resolution: "10s",
          type: "raw",
        },
      });

      // Handle aggregations
      await timeSeriesManager.aggregateStats();

      // Cleanup old data periodically (every 5 minutes)
      if (timestamp.getMinutes() % 5 === 0 && timestamp.getSeconds() === 0) {
        await timeSeriesManager.cleanupOldData();
      }
    } catch (error) {
      console.error("Error in collection cycle:", error);
    } finally {
      isCollecting = false;
    }
  }, interval);
});

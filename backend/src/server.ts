import { exec } from "child_process";
import express from "express";
import http from "http";
import superuserClient from "./pocketbase.js";
import { checkValidNumber, formatDockerStats, average } from "./utils.js";
import cors from "cors";
import { Stats } from "types/index.js";
import lodash from "lodash";
const { groupBy } = lodash;

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

const aggregateAndSaveStats = async (stats: Stats[]) => {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Save current stats at full resolution
  for (const stat of stats) {
    await superuserClient.collection("container_stats").create(stat);
  }

  // Aggregate older data
  const oldRecords = await superuserClient
    .collection("container_stats")
    .getList(1, 1000, {
      filter: `timestamp < '${hourAgo.toISOString()}'`,
      sort: "-timestamp",
    });

  if (oldRecords.items.length > 0) {
    // Group by container and 5-minute intervals for data older than 1 hour
    const groupedStats = groupBy(oldRecords.items, (record) => {
      const timestamp = new Date(record.timestamp);
      const interval = timestamp > dayAgo ? 60000 : 300000; // 1 min or 5 min
      const roundedTime = Math.floor(timestamp.getTime() / interval) * interval;
      return `${record.name}_${roundedTime}`;
    });

    // Calculate averages and save aggregated data
    for (const [_, records] of Object.entries(groupedStats)) {
      if (records.length <= 1) continue;

      const avgStats = {
        name: records[0].name,
        cpu_percent: average(records.map((r) => r.cpu_percent)),
        memory_usage: average(records.map((r) => r.memory_usage)),
        memory_limit: records[0].memory_limit,
        memory_percent: average(records.map((r) => r.memory_percent)),
        net_io_in: average(records.map((r) => r.net_io_in)),
        net_io_out: average(records.map((r) => r.net_io_out)),
        block_io_in: average(records.map((r) => r.block_io_in)),
        block_io_out: average(records.map((r) => r.block_io_out)),
        pids: Math.round(average(records.map((r) => r.pids))),
        timestamp: new Date(
          Math.max(...records.map((r) => new Date(r.timestamp).getTime()))
        ).toISOString(),
      };

      // Delete old records and save aggregated record
      for (const record of records.slice(1)) {
        await superuserClient.collection("container_stats").delete(record.id);
      }
      await superuserClient
        .collection("container_stats")
        .update(records[0].id, avgStats);
    }
  }
};

const collectDockerStats = (prevStats: Stats[]): Promise<Stats[]> => {
  return new Promise((resolve) => {
    exec(
      "docker stats --no-stream --format '{{json .}}'",
      async (err, stdout, stderr) => {
        if (err) {
          console.error("Error executing docker stats:", err);
          resolve([]);
          return;
        }
        if (stderr) {
          console.error("Error:", stderr);
          resolve([]);
          return;
        }
        const stats = stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
          .map((stat) => formatDockerStats(stat));

        await aggregateAndSaveStats(stats);
        resolve(stats);
      }
    );
  });
};

// Function to test PocketBase connection
async function testPocketBaseConnection() {
  try {
    // Try to get the health status of the server
    const health = await superuserClient.health.check();
    console.log("✅ PocketBase connection successful:", health);
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to PocketBase:", error);
    return false;
  }
}

let isCollecting = false;

// Modify server startup
server.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  // Test connection and authenticate
  const isConnected = await testPocketBaseConnection();

  const interval = checkValidNumber(process.env.INTERVAL || "5000");

  console.log("Interval:", interval);

  let prevStats: Stats[] = [];

  if (isConnected) {
    setInterval(async () => {
      if (isCollecting) return; // Skip if already collecting
      isCollecting = true;

      try {
        const stats = await collectDockerStats(prevStats);
        prevStats = stats;
      } finally {
        isCollecting = false;
      }
    }, interval);
  } else {
    console.error(
      "Stats collection disabled due to PocketBase connection failure"
    );
  }
});

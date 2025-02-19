import { exec } from "child_process";
import express from "express";
import http from "http";
import superuserClient from "./pocketbase.js";
import { checkValidNumber, formatDockerStats } from "./utils.js";
import cors from "cors";
import { Stats } from "types/index.js";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

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
          .map((line) => JSON.parse(line));

        try {
          const formattedStats = stats.map((stat) => formatDockerStats(stat));

          for (const stat of formattedStats) {
            await superuserClient.collection("container_stats").create(stat);
          }

          if (prevStats.length > formattedStats.length) {
            const deletedStats = prevStats
              .map((stat) => stat.name)
              .filter(
                (name) =>
                  !formattedStats.map((stat) => stat.name).includes(name)
              );
            console.log("Deleted stats:", deletedStats);
          }

          if (prevStats.length < formattedStats.length) {
            const newStats = formattedStats
              .map((stat) => stat.name)
              .filter((name) => !prevStats.map((s) => s.name).includes(name));
            console.log("New stats:", newStats);
          }

          resolve(formattedStats);
        } catch (error) {
          console.error("Error saving to PocketBase:", error);
          resolve([]);
        }
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

import { exec } from "child_process";
import express from "express";
import http from "http";
import superuserClient from "./pocketbase.js";
import { checkValidNumber, formatDockerStats } from "./utils.js";
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.json());

const collectDockerStats = () => {
  exec(
    "docker stats --no-stream --format '{{json .}}'",
    async (err, stdout, stderr) => {
      if (err) {
        console.error("Error executing docker stats:", err);
        return;
      }
      if (stderr) {
        console.error("Error:", stderr);
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
      } catch (error) {
        console.error("Error saving to PocketBase:", error);
      }
    }
  );
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

// Modify server startup
server.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  // Test connection and authenticate
  const isConnected = await testPocketBaseConnection();

  const interval = checkValidNumber(process.env.INTERVAL || "5000");

  if (isConnected) {
    setInterval(collectDockerStats, interval);
  } else {
    console.error(
      "Stats collection disabled due to PocketBase connection failure"
    );
  }
});

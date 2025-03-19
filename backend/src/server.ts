import { exec } from "child_process";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { TIME_SCALE_FACTOR } from "./contants/index.js";
import { TimeSeriesManager } from "./lib/time-series-manager.js";
import superuserClient from "./pocketbase.js";
import { ContainerStats } from "./types/index.js";
import { formatDockerStats } from "./utils.js";
import { middleware } from "./middleware.js";
import WebSocket, { WebSocketServer } from "ws";
import { spawn } from "child_process";

const app = express();

const PORT = Number(process.env.PORT) || 8000;
const timeSeriesManager = new TimeSeriesManager(superuserClient);

app.use(express.json());
app.use(cors());
// app.use(middleware);

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

const getContainerLogs = (containerId: string): Promise<string[]> => {
  return new Promise((resolve) => {
    exec(
      `docker logs ${containerId} --timestamps`,
      async (err, stdout, stderr) => {
        if (err || stderr) {
          console.error(err || stderr);
          resolve([]);
          return;
        }

        const logs = stdout.trim().split("\n");
        resolve(logs);
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

// Create HTTP server separately to attach both Express and WebSockets
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/node-api/ws", // Match the path used in the frontend
});

// WebSocket connection handler
wss.on("connection", (ws: WebSocket, req: any) => {
  // Extract container ID from URL
  console.log("WebSocket connection received:", req.url);

  // Parse the URL and query parameters
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const containerId = url.searchParams.get("containerId");

  if (!containerId) {
    ws.send(JSON.stringify({ error: "Container ID is required" }));
    ws.close();
    return;
  }

  console.log(`WebSocket connection established for container: ${containerId}`);

  // Use spawn instead of exec to get continuous output
  const dockerLogs = spawn("docker", [
    "logs",
    "--follow",
    "--timestamps",
    containerId,
  ]);

  // Stream log data as it comes in
  dockerLogs.stdout.on("data", (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data.toString());
    }
  });

  dockerLogs.stderr.on("data", (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data.toString());
    }
  });

  // Handle process errors
  dockerLogs.on("error", (error) => {
    console.error(`Docker logs error for ${containerId}:`, error);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({ error: `Failed to stream logs: ${error.message}` })
      );
    }
  });

  // Clean up when WebSocket closes
  ws.on("close", () => {
    console.log(`WebSocket connection closed for container: ${containerId}`);
    dockerLogs.kill();
  });
});

// Add a basic HTTP endpoint to get container logs via REST as well
app.get("/node-api/container-logs/:containerId", async (req, res) => {
  try {
    const logs = await getContainerLogs(req.params.containerId);
    res.json({ logs });
  } catch (error) {
    console.error("Error fetching container logs:", error);
    res.status(500).json({ error: "Failed to fetch container logs" });
  }
});

// Start server
server.listen(PORT, "0.0.0.0", async () => {
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

    console.log("Collecting stats");

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

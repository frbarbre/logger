// Simple WebSocket client for testing the container logs endpoint
import WebSocket from "ws";

// Change these values as needed
const PORT = 8000;
const CONTAINER_ID = "logger-node-app-1"; // Replace with your container ID

// Connect to WebSocket server
const ws = new WebSocket(`ws://localhost:${PORT}?containerId=${CONTAINER_ID}`);

ws.on("open", () => {
  console.log("Connected to WebSocket server");
  console.log(`Streaming logs for container: ${CONTAINER_ID}`);
});

ws.on("message", (data) => {
  // Handle different message formats (string or JSON)
  try {
    const jsonData = JSON.parse(data.toString());
    if (jsonData.error) {
      console.error(`Error: ${jsonData.error}`);
    } else {
      console.log(JSON.stringify(jsonData, null, 2));
    }
  } catch (e) {
    // Not JSON, treat as plain text
    console.log(data.toString());
  }
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

ws.on("close", (code, reason) => {
  console.log(`Connection closed: ${code} - ${reason}`);
});

// Handle CTRL+C to gracefully close the connection
process.on("SIGINT", () => {
  console.log("Closing WebSocket connection...");
  ws.close();
  process.exit(0);
});

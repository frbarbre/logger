import express from "express";
import http from "http";
import PocketBase from "pocketbase";
import { exec } from "child_process";
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const pb = new PocketBase(process.env.POCKETBASE_URL || "http://0.0.0.0:8090");
// Add these environment variables
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
app.use(express.json());
// Function to collect and save Docker stats
const collectDockerStats = () => {
    exec("docker stats --no-stream --format '{{json .}}'", async (err, stdout, stderr) => {
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
        // Save stats to PocketBase
        try {
            await pb.collection("container_stats").create(stats[0]);
        }
        catch (error) {
            console.error("Error saving to PocketBase:", error);
        }
    });
};
// Function to test PocketBase connection
async function testPocketBaseConnection() {
    try {
        // Try to get the health status of the server
        const health = await pb.health.check();
        console.log("✅ PocketBase connection successful:", health);
        return true;
    }
    catch (error) {
        console.error("❌ Failed to connect to PocketBase:", error);
        return false;
    }
}
// Modify server startup to include connection test
server.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    // Test connection before starting stats collection
    const isConnected = await testPocketBaseConnection();
    if (isConnected) {
        // Only start collecting stats if connection is successful
        setInterval(collectDockerStats, 5000);
    }
    else {
        console.error("Stats collection disabled due to PocketBase connection failure");
    }
});
//# sourceMappingURL=server.js.map
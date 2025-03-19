"use client";

import { useEffect, useState, useRef } from "react";

// Define a type for log entries
type LogEntry = {
  message: string;
  color: string;
};

export default function Page() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [containerId, setContainerId] = useState<string>("logger-node-app-1");
  const [status, setStatus] = useState<string>("Disconnected");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [containerId]);

  const connectWebSocket = () => {
    // Close any existing connection
    if (ws) {
      ws.close();
    }

    setStatus(`Connecting to ${containerId}...`);
    const newWs = new WebSocket(
      process.env.NEXT_PUBLIC_WS_URL! + `?containerId=${containerId}`
    );
    setWs(newWs);

    newWs.onopen = () => {
      setStatus(`Connected to ${containerId}`);
      appendLog("Connected to WebSocket server", "green");
    };

    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          appendLog(`ERROR: ${data.error}`, "red");
        } else {
          appendLog(JSON.stringify(data, null, 2));
        }
      } catch (e) {
        // Not JSON, treat as plain text
        appendLog(event.data);
      }
    };

    newWs.onclose = () => {
      setStatus("Disconnected");
      appendLog("Connection closed", "orange");
    };

    newWs.onerror = (error) => {
      setStatus("Error");
      appendLog(`WebSocket error: ${error}`, "red");
    };
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  const appendLog = (message: string, color = "black") => {
    setLogs((prevLogs) => [...prevLogs, { message, color }]);

    // Scroll to bottom on next render
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop =
          logContainerRef.current.scrollHeight;
      }
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newContainerId = formData.get("containerId") as string;
    setContainerId(newContainerId);
  };

  return (
    <div className="p-5 font-sans">
      <h1 className="text-2xl font-bold mb-4">Container Logs WebSocket Test</h1>
      <div className="mb-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center mb-2">
          <label htmlFor="containerId">Container ID:</label>
          <input
            type="text"
            id="containerId"
            name="containerId"
            defaultValue={containerId}
            className="border border-gray-300 rounded px-2 py-1"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            Connect
          </button>
          <button
            type="button"
            onClick={disconnect}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
          >
            Disconnect
          </button>
        </form>
        <div id="status" className="font-semibold">
          {status}
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">Logs:</h3>
      <div
        ref={logContainerRef}
        className="w-full h-[500px] overflow-y-auto border border-gray-300 rounded p-4 font-mono whitespace-pre-wrap"
      >
        {logs.map((log, index) => (
          <div key={index} style={{ color: log.color }}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

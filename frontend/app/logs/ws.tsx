"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Container, Session } from "@/types";
import { useEffect, useState, useRef } from "react";

// Define a type for log entries
type LogEntry = {
  message: string;
  color: string;
};

export default function WS({
  session,
  containers,
}: {
  session: Session;
  containers: Container[] | null;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [containerId, setContainerId] = useState<string>(
    containers?.[0]?.Names || ""
  );
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
      process.env.NEXT_PUBLIC_WS_URL! +
        `?containerId=${containerId}&token=${session.user.token}`
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

  return (
    <div className="p-5 font-sans">
      <h1 className="text-2xl font-bold mb-4">Container Logs WebSocket Test</h1>
      <div className="mb-4">
        <Select
          value={containerId}
          onValueChange={(v) => {
            setContainerId(v);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a container" />
          </SelectTrigger>
          <SelectContent>
            {containers?.map((container) => (
              <SelectItem key={container.ID} value={container.Names}>
                {container.Names}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

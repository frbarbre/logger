export function formatDockerStats(stats: {
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  MemPerc: string;
  NetIO: string;
  BlockIO: string;
  PIDS: string;
}) {
  // Helper function to convert sizes to MB
  const convertToMB = (value: string): number => {
    const num = parseFloat(value);
    if (value.includes("GB")) return num * 1024;
    if (value.includes("kB") || value.includes("KB")) return num / 1024;
    if (value.includes("GiB")) return num * 1024;
    if (value.includes("MiB")) return num;
    if (value.includes("MB")) return num;
    return num; // Assume MB if no unit
  };

  // Parse memory usage which can be in format "177.6MiB / 7.755GiB"
  const memoryParts = stats.MemUsage?.split("/").map((part) => part.trim());
  const memoryUsage = memoryParts?.[0] || "0";
  const memoryLimit = memoryParts?.[1] || "0";

  // Parse network IO which can be in format "1.21GB / 3.82GB"
  const netParts = stats.NetIO?.split("/").map((part) => part.trim());
  const netIn = netParts?.[0] || "0";
  const netOut = netParts?.[1] || "0";

  // Parse block IO which can be in format "146MB / 784MB"
  const blockParts = stats.BlockIO?.split("/").map((part) => part.trim());
  const blockIn = blockParts?.[0] || "0";
  const blockOut = blockParts?.[1] || "0";

  return {
    name: stats.Name,
    cpu_percent: parseFloat(stats.CPUPerc?.replace("%", "") || "0"),
    memory_usage: convertToMB(memoryUsage),
    memory_limit: convertToMB(memoryLimit),
    memory_percent: parseFloat(stats.MemPerc?.replace("%", "") || "0"),
    net_io_in: convertToMB(netIn),
    net_io_out: convertToMB(netOut),
    block_io_in: convertToMB(blockIn),
    block_io_out: convertToMB(blockOut),
    pids: parseInt(stats.PIDS || "0"),
    timestamp: new Date().toISOString(),
  };
}

export function checkValidNumber(value: string) {
  const number = Number(value);

  if (isNaN(number)) {
    throw new Error("INTERVAL environment variable must be a number");
  }

  return number;
}

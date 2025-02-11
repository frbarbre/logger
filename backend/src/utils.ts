export function formatDockerStats(stats: {
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  MemPerc: string;
  NetIO: string;
  BlockIO: string;
  PIDS: string;
}) {
  return {
    name: stats.Name,
    cpu_percent: parseFloat(stats.CPUPerc?.replace("%", "") || "0"),
    memory_usage: parseInt(
      stats.MemUsage?.split("/")[0]?.replace("MiB", "") || "0"
    ),
    memory_limit: parseInt(
      stats.MemUsage?.split("/")[1]?.replace("MiB", "") || "0"
    ),
    memory_percent: parseFloat(stats.MemPerc?.replace("%", "") || "0"),
    net_io_in: parseInt(stats.NetIO?.split("/")[0]?.replace("MB", "") || "0"),
    net_io_out: parseInt(stats.NetIO?.split("/")[1]?.replace("MB", "") || "0"),
    block_io_in: parseInt(
      stats.BlockIO?.split("/")[0]?.replace("MB", "") || "0"
    ),
    block_io_out: parseInt(
      stats.BlockIO?.split("/")[1]?.replace("MB", "") || "0"
    ),
    pids: parseInt(stats.PIDS || "0"),
    timestamp: new Date().toISOString(),
  };
}

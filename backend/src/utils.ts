import { ContainerStats } from "./types/index.js";

export function parseMemory(memoryString: string): number {
  const value = parseFloat(memoryString);
  const unit = memoryString.slice(-2);

  switch (unit.toLowerCase()) {
    case "kb":
      return value * 1024;
    case "mb":
      return value * 1024 * 1024;
    case "gb":
      return value * 1024 * 1024 * 1024;
    case "tb":
      return value * 1024 * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

export function parsePercentage(percentString: string): number {
  return parseFloat(percentString.replace("%", ""));
}

export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

export function formatDockerStats(rawStats: any): ContainerStats {
  return {
    name: rawStats.Name,
    cpu_percent: parsePercentage(rawStats.CPUPerc),
    memory_usage: parseMemory(rawStats.MemUsage.split("/")[0]),
    memory_limit: parseMemory(rawStats.MemUsage.split("/")[1]),
    memory_percent: parsePercentage(rawStats.MemPerc),
    net_io_in: parseMemory(rawStats.NetIO.split("/")[0]),
    net_io_out: parseMemory(rawStats.NetIO.split("/")[1]),
    block_io_in: parseMemory(rawStats.BlockIO.split("/")[0]),
    block_io_out: parseMemory(rawStats.BlockIO.split("/")[1]),
    pids: parseInt(rawStats.PIDs),
  };
}

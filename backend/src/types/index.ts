export type Stats = {
  name: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  net_io_in: number;
  net_io_out: number;
  block_io_in: number;
  block_io_out: number;
  pids: number;
  timestamp: string;
};

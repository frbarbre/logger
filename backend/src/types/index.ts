export interface TimeSeriesConfig {
  id: string;
  name: string;
  retention: string;
  resolution: string;
  startFrom?: string;
  until?: string;
}

export interface ContainerStats {
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
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

interface TimeSeriesMetadata {
  resolution?: string;
  aggregationType?: string;
  count?: number; // Number of times this record has been averaged
}

export interface TimeSeriesPoint {
  id?: string;
  timestamp: Date;
  containers: {
    [id: string]: ContainerStats;
  };
  metadata?: TimeSeriesMetadata;
}

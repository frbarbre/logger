export type Session = {
  user: {
    token: string;
    record: {
      collectionId: string;
      collectionName: string;
      created: string;
      email: string;
      emailVisibility: boolean;
      id: string;
      updated: string;
      verified: boolean;
    };
  };
};

export type ContainerStats = {
  block_io_in: number;
  block_io_out: number;
  collectionId: string;
  collectionName: string;
  cpu_percent: number;
  id: string;
  memory_limit: number;
  memory_percent: number;
  memory_usage: number;
  name: string;
  net_io_in: number;
  net_io_out: number;
  pids: number;
  timestamp: string;
};

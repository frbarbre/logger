import { exec } from "child_process";
import { ContainerStats } from "./types/index.js";
import { formatDockerStats } from "./utils.js";

export async function collectDockerStats(): Promise<{
  [containerId: string]: ContainerStats;
}> {
  return new Promise((resolve) => {
    exec(
      "docker stats --no-stream --format '{{json .}}'",
      async (err, stdout, stderr) => {
        if (err || stderr) {
          console.error(err || stderr);
          resolve({});
          return;
        }

        const containerStats = stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
          .map((stat) => {
            const formatted = formatDockerStats(stat);
            return [formatted.name, formatted] as const;
          })
          .reduce<{ [key: string]: ContainerStats }>((acc, [name, stats]) => {
            acc[name] = stats;
            return acc;
          }, {});

        resolve(containerStats);
      }
    );
  });
}

export async function getContainerLogs(containerId: string): Promise<string[]> {
  return new Promise((resolve) => {
    exec(
      `docker logs ${containerId} --timestamps`,
      async (err, stdout, stderr) => {
        if (err || stderr) {
          console.error(err || stderr);
          resolve([]);
          return;
        }

        const logs = stdout.trim().split("\n");
        resolve(logs);
      }
    );
  });
}

export async function getContainers(): Promise<string[]> {
  return new Promise((resolve) => {
    exec(`docker ps -a --format '{{json .}}'`, async (err, stdout, stderr) => {
      if (err || stderr) {
        console.error(err || stderr);
        resolve([]);
        return;
      }

      const containers = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .map((stat) => {
          return stat;
        });

      resolve(containers);
    });
  });
}

export async function getIpAddress(): Promise<string> {
  return new Promise((resolve) => {
    exec("curl -s ipinfo.io/ip", (err, stdout, stderr) => {
      if (err || stderr) {
        console.error(err || stderr);
        resolve("");
        return;
      }

      resolve(stdout.trim());
    });
  });
}

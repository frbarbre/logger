import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

export async function getContainerStats() {
  const records = await pb.collection("container_stats").getList(1, 10, {
    sort: "-timestamp",
  });
  return records.items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export const containerStatsQuery = {
  queryKey: ["container-stats"],
  queryFn: getContainerStats,
};

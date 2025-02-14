import PocketBase from "pocketbase";

export async function getContainerStats(pb: PocketBase) {
  if (!pb.authStore.isSuperuser) {
    return null;
  }

  const records = await pb.collection("container_stats").getList(1, 10, {
    sort: "-timestamp",
  });
  return records.items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export const containerStatsQuery = (pb: PocketBase) => ({
  queryKey: ["container-stats"],
  queryFn: () => getContainerStats(pb),
});

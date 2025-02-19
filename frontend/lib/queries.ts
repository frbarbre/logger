import PocketBase from "pocketbase";

export async function getContainerStats(pb: PocketBase) {
  if (!pb.authStore.isSuperuser) {
    return null;
  }

  const records = await pb.collection("container_stats").getList(1, 10, {
    sort: "-timestamp",
  });
  return records.items;
}

export const containerStatsQuery = (pb: PocketBase) => ({
  queryKey: ["container-stats"],
  queryFn: () => getContainerStats(pb),
});

export async function getContainerStatsBetweenDates(
  pb: PocketBase,
  startTime: Date,
  endTime: Date
) {
  if (!pb.authStore.isSuperuser) {
    return null;
  }

  // Format dates to match PocketBase's format: "YYYY-MM-DD HH:mm:ss.SSSZ"
  const startTimeString = startTime.toISOString().replace("T", " ");
  const endTimeString = endTime.toISOString().replace("T", " ");

  console.log(startTimeString, endTimeString);

  const records = await pb.collection("container_stats").getList(1, 1000000, {
    sort: "-timestamp",
    filter: `timestamp >= "${startTimeString}" && timestamp <= "${endTimeString}"`,
  });
  return records.items;
}

export const containerStatsBetweenDatesQuery = (
  pb: PocketBase,
  startTime: Date,
  endTime: Date
) => ({
  queryKey: ["container-stats", startTime.toISOString(), endTime.toISOString()],
  queryFn: () => getContainerStatsBetweenDates(pb, startTime, endTime),
});

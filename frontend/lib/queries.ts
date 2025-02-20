import PocketBase, { RecordModel } from "pocketbase";
import { formatDate } from "./utils";

export async function getContainerStatsBetweenDates(
  pb: PocketBase,
  startTime: string | null,
  endTime: string | null
) {
  if (!pb.authStore.isSuperuser) {
    return null;
  }

  const perPage = 1000; // PocketBase max items per page
  let allItems: RecordModel[] = [];
  let page = 1;

  while (true) {
    const records = await pb
      .collection("container_stats")
      .getList(page, perPage, {
        sort: "-timestamp",
        filter: `timestamp >= "${startTime}" && timestamp <= "${endTime}"`,
      });

    allItems = [...allItems, ...records.items];

    // If we've received fewer items than the page size, we've reached the end
    if (records.items.length < perPage) {
      break;
    }

    page++;
  }

  return allItems;
}

export const containerStatsBetweenDatesQuery = (
  pb: PocketBase,
  startTime: string | null,
  endTime: string | null
) => ({
  queryKey: ["container-stats", startTime, endTime],
  queryFn: () =>
    getContainerStatsBetweenDates(
      pb,
      formatDate(startTime),
      formatDate(endTime)
    ),
});

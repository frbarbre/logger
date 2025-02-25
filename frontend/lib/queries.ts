import PocketBase from "pocketbase";
import { formatDate } from "./utils";

export async function getContainerStatsBetweenDates(
  pb: PocketBase,
  startTime: string | null,
  endTime: string | null
) {
  if (!pb.authStore.isSuperuser) {
    return [];
  }

  if (!startTime || !endTime) {
    return [];
  }

  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_API_URL +
        "/node-api/stats/history?" +
        new URLSearchParams({
          start: startTime,
          end: endTime,
        }),
      {
        headers: {
          Authorization: `Bearer ${pb.authStore.token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(response);
      return [];
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
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

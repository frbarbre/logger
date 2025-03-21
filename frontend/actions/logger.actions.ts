"use server";

import { getSession } from "@/lib/auth";
import { Container } from "@/types";

export async function getContainers(): Promise<Container[] | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_API_URL + "/node-api/containers",
      {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch containers");
    }

    return response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getServerIpAddress(): Promise<{ ip: string } | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_API_URL + "/node-api/ip",
      {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch server IP address");
    }

    return response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

import { getSession } from "@/lib/auth";
import WS from "./ws";
import { redirect } from "next/navigation";
import { getContainers } from "@/actions/logger.actions";

export default async function Page() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const containers = await getContainers();

  return <WS session={session} containers={containers} />;
}

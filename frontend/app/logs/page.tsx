import { getSession } from "@/lib/auth";
import WS from "./ws";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <WS session={session} />;
}

import { getSession } from "@/lib/auth";
import PocketBase from "pocketbase";

async function client() {
  const pb = new PocketBase(process.env.POCKETBASE_URL);
  const session = await getSession();
  if (session) {
    pb.authStore.save(session.user.token, session.user.record);
  }

  return pb;
}

export default client;

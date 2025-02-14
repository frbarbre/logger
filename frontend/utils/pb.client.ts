import { Session } from "@/types";
import PocketBase from "pocketbase";

function client(session: Session) {
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  if (session) {
    pb.authStore.save(session.user.token, session.user.record);
  }
  return pb;
}

export default client;

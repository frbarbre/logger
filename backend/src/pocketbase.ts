import PocketBase from "pocketbase";

const superuserClient = new PocketBase(
  process.env.POCKETBASE_URL || "http://0.0.0.0:8090"
);

superuserClient.autoCancellation(false);

await superuserClient
  .collection("_superusers")
  .authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL!,
    process.env.POCKETBASE_ADMIN_PASSWORD!
  );

export default superuserClient;

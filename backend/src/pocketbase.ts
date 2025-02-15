import PocketBase from "pocketbase";

const superuserClient = new PocketBase(
  process.env.POCKETBASE_URL || "http://pocketbase:8090"
);

superuserClient.autoCancellation(false);

try {
  await superuserClient
    .collection("_superusers")
    .authWithPassword(
      process.env.POCKETBASE_ADMIN_EMAIL!,
      process.env.POCKETBASE_ADMIN_PASSWORD!
    );
} catch (error) {
  console.error("Failed to authenticate with PocketBase:", error);
}

export default superuserClient;

import { getSession, logout } from "@/lib/auth";
import Link from "next/link";

export default async function Header() {
  const session = await getSession();

  return (
    <div>
      {session ? (
        <form
          action={async () => {
            "use server";
            await logout();
          }}
        >
          <p>Logged in as {session.user.record.email}</p>
          <button type="submit">Sign out</button>
        </form>
      ) : (
        <Link href="/login">Login</Link>
      )}
    </div>
  );
}

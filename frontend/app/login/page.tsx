import { login, getSession } from "@/lib/auth";
import client from "@/utils/pb.server";
import { redirect } from "next/navigation";
export default async function Page() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  return (
    <main>
      Login form
      <form
        action={async (formData) => {
          "use server";
          const email = formData.get("email") as string;
          const password = formData.get("password") as string;

          const pb = await client();

          try {
            const auth = await pb
              .collection("_superusers")
              .authWithPassword(email, password);
            await login(auth);
          } catch (error) {
            console.error(error);
          }
        }}
      >
        <label>
          E-mail
          <input name="email" type="email" />
        </label>
        <label>
          Password
          <input name="password" />
        </label>
        <button type="submit">Login</button>
      </form>
    </main>
  );
}

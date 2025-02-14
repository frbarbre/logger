import { login, getSession } from "@/lib/auth";

export default async function Page() {
  const session = await getSession();

  if (session) return null;

  return (
    <main>
      Login form
      <form
        action={async (formData) => {
          "use server";
          const email = formData.get("email") as string;
          const password = formData.get("password") as string;
          await login(email, password);
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

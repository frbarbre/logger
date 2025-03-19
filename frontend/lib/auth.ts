import { Session } from "@/types";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.SESSION_SECRET;
const key = new TextEncoder().encode(secretKey);
const cookieName = "pb_auth";

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1 year from now")
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function login(user: any) {
  // Create the session
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ user, expires });

  // Save the session in a cookie
  const cookieStore = await cookies();
  cookieStore.set(cookieName, session, { expires, httpOnly: true });
}

export async function logout() {
  // Destroy the session
  const cookieStore = await cookies();
  cookieStore.set(cookieName, "", { expires: new Date(0) });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(cookieName)?.value;
  if (!session) return null;
  return await decrypt(session);
}

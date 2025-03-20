"use server";

import { formSchema } from "@/components/login-form";
import { login } from "@/lib/auth";
import client from "@/utils/pb.server";
import { z } from "zod";

export async function signIn(values: z.infer<typeof formSchema>) {
  const email = values.email;
  const password = values.password;

  const pb = await client();

  try {
    const auth = await pb
      .collection("_superusers")
      .authWithPassword(email, password);

    await login(auth);
  } catch (error) {
    console.error(error);
    return error;
  }
}

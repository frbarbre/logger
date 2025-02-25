import PocketBase from "../node_modules/pocketbase/dist/pocketbase.es.mjs";
import { Request, Response, NextFunction } from "express";

const whitelist = ["/node-api/hello"];

export async function middleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (whitelist.some((path) => req.path.startsWith(path))) {
    next();
    return;
  }

  const token = req.headers.authorization;

  if (!token) {
    res.status(401).json({ error: "Please provide a valid token" });
    return;
  }

  const pb = new PocketBase(process.env.POCKETBASE_URL);

  pb.authStore.save(token.replace("Bearer ", ""));

  if (!pb.authStore.isSuperuser) {
    res
      .status(401)
      .json({ error: "Unauthorized, please use a superuser token" });
    return;
  }

  next();
}

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.isAdmin) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "需要管理員權杖：在 Authorization: Bearer <ADMIN_TOKEN> 標頭中提供",
    });
  }
  return opts.next();
});

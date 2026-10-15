import { Elysia } from "elysia";
import { config } from "@/config/configs";

const startedAt = Date.now();

export const healthRoutes = new Elysia().get("/", () => ({
  data: {
    status: "ok",
    service: config.service.name,
    version: config.service.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  },
}));

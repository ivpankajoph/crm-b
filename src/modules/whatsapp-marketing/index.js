import { createServer } from "http";
import { Router } from "express";
import {
  registerRoutes,
  startEmbeddedBackgroundJobs,
} from "./whatsapp-marketing.routes.bundle.js";

const whatsappMarketingRouter = Router();

const stripApiPrefix = (path) => {
  if (typeof path !== "string") return path;
  const next = path.replace(/^\/api(?=\/|$)/, "");
  return next || "/";
};

const appShim = {
  get: (path, ...handlers) =>
    whatsappMarketingRouter.get(stripApiPrefix(path), ...handlers),
  post: (path, ...handlers) =>
    whatsappMarketingRouter.post(stripApiPrefix(path), ...handlers),
  put: (path, ...handlers) =>
    whatsappMarketingRouter.put(stripApiPrefix(path), ...handlers),
  patch: (path, ...handlers) =>
    whatsappMarketingRouter.patch(stripApiPrefix(path), ...handlers),
  delete: (path, ...handlers) =>
    whatsappMarketingRouter.delete(stripApiPrefix(path), ...handlers),
  use: (path, ...handlers) => {
    if (typeof path === "string") {
      return whatsappMarketingRouter.use(stripApiPrefix(path), ...handlers);
    }
    return whatsappMarketingRouter.use(path, ...handlers);
  },
};

await registerRoutes(createServer(), appShim);

export const startWhatsAppMarketingBackgroundJobs = async () => {
  await startEmbeddedBackgroundJobs();
};

export default whatsappMarketingRouter;

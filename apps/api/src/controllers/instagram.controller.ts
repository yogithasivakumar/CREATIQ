import type { NextFunction, Request, Response } from "express";
import { loadEnv } from "../config/env.js";
import { getOrCreateDefaultWorkspace } from "../services/workspace.service.js";
import {
  completeInstagramConnect,
  disconnectInstagram,
  getInstagramStatus,
  publishAssetToInstagram,
  startInstagramConnect,
} from "../services/instagram/instagram.service.js";
import {
  cancelScheduledPost,
  listScheduledPosts,
  publishScheduledPost,
  scheduleInstagramPost,
} from "../services/instagram/scheduledPosts.service.js";
import { InstagramError } from "../services/instagram/instagramError.js";
import type { PublishPostRequest, SchedulePostRequest } from "../validation/instagram.schema.js";

// Returns the Meta authorization URL as JSON (rather than redirecting
// this call itself) so the frontend can keep using its normal
// Bearer-token-authenticated apiFetch() to reach this endpoint, then
// do a real browser navigation (window.location) to the returned URL
// — Meta's OAuth dialog has to be a top-level browser navigation, not
// a fetch, so it can show Meta's own login/consent screen.
export async function getInstagramConnectUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const url = startInstagramConnect(req.user!.id, workspaceId);
    res.json({ ok: true, url });
  } catch (error) {
    next(error);
  }
}

// The frontend origin to redirect back to after the OAuth round-trip.
// This must come from server-side config (CORS_ORIGIN), never from a
// request parameter — Meta's redirect is an unauthenticated browser
// navigation, so an attacker-controlled "frontendOrigin" query param
// would be an open redirect. CORS_ORIGIN may list multiple allowed
// origins (comma-separated); the first one is the CREATIQ frontend's
// own origin and is what the browser should land back on.
function getFrontendOrigin(): string {
  const env = loadEnv();
  const [firstOrigin] = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  return firstOrigin;
}

// Route matches apps/web/src/app/dashboard/instagram/page.tsx, which
// is where Instagram Publishing (and its Connect/caption/publish flow)
// lives — both successful and failed connections return here so the
// user lands back where they started the flow.
const FRONTEND_INSTAGRAM_URL = (origin: string) => `${origin}/dashboard/instagram`;

// This IS a real browser navigation from Meta, so it can't carry a
// Bearer token — identity comes from the `state` value minted by
// getInstagramConnectUrl and matched server-side in
// completeInstagramConnect, not from requireAuth.
export async function getInstagramCallback(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const redirectBase = FRONTEND_INSTAGRAM_URL(getFrontendOrigin());

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const metaError = req.query.error as string | undefined;

  if (metaError) {
    res.redirect(`${redirectBase}?instagram=error&reason=${encodeURIComponent(metaError)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${redirectBase}?instagram=error&reason=missing_code_or_state`);
    return;
  }

  try {
    await completeInstagramConnect(code, state);
    res.redirect(`${redirectBase}?instagram=connected`);
  } catch (error) {
    const reason =
      error instanceof InstagramError || error instanceof Error
        ? error.message
        : "unknown_error";
    console.error("[instagram:callback]", error);
    res.redirect(`${redirectBase}?instagram=error&reason=${encodeURIComponent(reason)}`);
  }
}

export async function getInstagramStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const status = await getInstagramStatus(workspaceId);
    res.json({ ok: true, ...status });
  } catch (error) {
    next(error);
  }
}

export async function postInstagramDisconnect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    await disconnectInstagram(workspaceId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function postInstagramPublish(
  req: Request<unknown, unknown, PublishPostRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const result = await publishAssetToInstagram(workspaceId, req.body.assetId, req.body.caption);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function postInstagramSchedule(
  req: Request<unknown, unknown, SchedulePostRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const post = await scheduleInstagramPost(workspaceId, req.user!.id, req.body);
    res.status(201).json({ ok: true, post });
  } catch (error) {
    next(error);
  }
}

export async function getInstagramScheduled(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const posts = await listScheduledPosts(workspaceId);
    res.json({ ok: true, posts });
  } catch (error) {
    next(error);
  }
}

export async function postInstagramScheduledPublishNow(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const post = await publishScheduledPost(workspaceId, req.params.id);
    res.json({ ok: true, post });
  } catch (error) {
    next(error);
  }
}

export async function deleteInstagramScheduled(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    await cancelScheduledPost(workspaceId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

-- ============================================================
-- CREATIQ: Settings, Instagram connections, scheduled posts
-- Migration: 20261029230400_instagram_and_settings.sql
-- ============================================================
--
-- Three new tables for the Settings page and Instagram Publishing
-- feature. All three follow the workspace-scoped convention already
-- established by the initial schema: RLS enabled, and since the
-- backend always writes through the service-role client (which
-- bypasses RLS and enforces ownership itself in application code,
-- exactly like assets/projects already do), these tables grant NO
-- direct client access at all — no SELECT/INSERT/UPDATE/DELETE policy
-- for `authenticated`. This is intentionally stricter than
-- projects/assets: user_settings and instagram_connections hold
-- preference data and (for the latter) a sensitive OAuth token, and
-- the Instagram access token in particular must never be reachable
-- from a client-side Supabase query under any circumstance.

BEGIN;

-- ------------------------------------------------------------
-- 1. USER SETTINGS
-- ------------------------------------------------------------
-- One row per user (not per workspace) — caption/publishing
-- preferences are a personal choice, not something a workspace's
-- other members should share or override.

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    default_caption_style TEXT NOT NULL DEFAULT 'product_highlight'
        CHECK (default_caption_style IN (
            'product_highlight', 'storytelling', 'promotional',
            'lifestyle', 'educational'
        )),
    default_tone TEXT NOT NULL DEFAULT 'engaging_friendly'
        CHECK (default_tone IN (
            'engaging_friendly', 'professional', 'playful',
            'luxurious', 'minimal'
        )),
    default_length TEXT NOT NULL DEFAULT 'medium'
        CHECK (default_length IN ('short', 'medium', 'long')),
    hashtag_count INTEGER NOT NULL DEFAULT 5
        CHECK (hashtag_count BETWEEN 0 AND 30),
    custom_hashtags JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(custom_hashtags) = 'array'),
    publish_now_default BOOLEAN NOT NULL DEFAULT true,
    scheduling_timezone TEXT NOT NULL DEFAULT 'UTC',
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 2. INSTAGRAM CONNECTIONS
-- ------------------------------------------------------------
-- One row per workspace. access_token is the long-lived Meta token —
-- backend-only, never selected into any API response.

CREATE TABLE public.instagram_connections (
    workspace_id UUID PRIMARY KEY
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    meta_user_id TEXT NOT NULL,
    instagram_business_account_id TEXT NOT NULL,
    instagram_username TEXT,
    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'connected'
        CHECK (status IN ('connected', 'expired', 'revoked')),
    connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER instagram_connections_updated_at
    BEFORE UPDATE ON public.instagram_connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3. SCHEDULED POSTS
-- ------------------------------------------------------------

CREATE TABLE public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    caption TEXT NOT NULL,
    hashtags JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(hashtags) = 'array'),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'published', 'failed', 'cancelled')),
    published_post_id TEXT,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (asset_id, workspace_id)
        REFERENCES public.assets(id, workspace_id) ON DELETE CASCADE
);

CREATE TRIGGER scheduled_posts_updated_at
    BEFORE UPDATE ON public.scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_scheduled_posts_workspace_status
    ON public.scheduled_posts(workspace_id, status, scheduled_for);

-- ------------------------------------------------------------
-- 4. RLS — enabled, no client-role policies (backend-only access,
-- same reasoning as generation_outputs/audit_events: service-role
-- bypasses RLS and enforces workspace/user ownership in application
-- code, exactly like assets.service.ts and projects.service.ts do).
-- ------------------------------------------------------------

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.instagram_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.scheduled_posts FROM PUBLIC, anon, authenticated;

COMMIT;

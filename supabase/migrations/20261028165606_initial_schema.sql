-- ============================================================
-- CREATIQ: Initial Database Schema
-- Migration: 20261028165606_initial_schema.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. WORKSPACES
-- ------------------------------------------------------------

CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

-- ------------------------------------------------------------
-- 2. PROJECTS AND CAMPAIGNS
-- ------------------------------------------------------------

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, workspace_id)
);

CREATE TABLE public.brand_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    colours JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(colours) = 'array'),
    fonts JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(fonts) = 'array'),
    rules JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(rules) = 'object'),
    logo_asset_id UUID,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, workspace_id)
);

CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    project_id UUID NOT NULL,
    brand_profile_id UUID,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    brief JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(brief) = 'object'),
    target_audience TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (project_id, workspace_id)
        REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,

    FOREIGN KEY (brand_profile_id, workspace_id)
        REFERENCES public.brand_profiles(id, workspace_id)
        ON DELETE SET NULL (brand_profile_id),

    UNIQUE (id, workspace_id)
);

-- ------------------------------------------------------------
-- 3. ASSETS
-- ------------------------------------------------------------

CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0),
    width INTEGER CHECK (width > 0),
    height INTEGER CHECK (height > 0),
    sha256 TEXT,
    asset_type TEXT NOT NULL DEFAULT 'image'
        CHECK (asset_type IN ('image', 'font', 'document', 'other')),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(tags) = 'array'),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, workspace_id)
);

-- The logo must belong to the same workspace as the brand.
ALTER TABLE public.brand_profiles
    ADD CONSTRAINT brand_logo_same_workspace_fk
    FOREIGN KEY (logo_asset_id, workspace_id)
    REFERENCES public.assets(id, workspace_id)
    ON DELETE SET NULL (logo_asset_id);

-- ------------------------------------------------------------
-- 4. DESIGNS AND IMMUTABLE VERSIONS
-- ------------------------------------------------------------

CREATE TABLE public.designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    campaign_id UUID,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
    current_version_id UUID,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (campaign_id, workspace_id)
        REFERENCES public.campaigns(id, workspace_id) ON DELETE CASCADE,
    UNIQUE (id, workspace_id)
);

CREATE TABLE public.design_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    design_id UUID NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    document JSONB NOT NULL
        CHECK (jsonb_typeof(document) = 'object'),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (design_id, workspace_id)
        REFERENCES public.designs(id, workspace_id) ON DELETE CASCADE,

    UNIQUE (design_id, version_number),
    UNIQUE (id, design_id, workspace_id),
    UNIQUE (id, workspace_id)
);

ALTER TABLE public.designs
    ADD CONSTRAINT design_current_version_fk
    FOREIGN KEY (current_version_id, id, workspace_id)
    REFERENCES public.design_versions(id, design_id, workspace_id)
    DEFERRABLE INITIALLY DEFERRED;

-- ------------------------------------------------------------
-- 5. AI GENERATION JOBS AND OUTPUTS
-- ------------------------------------------------------------

CREATE TABLE public.generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id UUID,
    design_id UUID,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'cloudflare_workers_ai',
    model TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN (
            'queued', 'processing', 'succeeded',
            'failed', 'cancelled'
        )),
    prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(parameters) = 'object'),
    error_code TEXT,
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (campaign_id, workspace_id)
        REFERENCES public.campaigns(id, workspace_id) ON DELETE CASCADE,

    FOREIGN KEY (design_id, workspace_id)
        REFERENCES public.designs(id, workspace_id) ON DELETE CASCADE,

    UNIQUE (id, workspace_id)
);

CREATE TABLE public.generation_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    job_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    seed BIGINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (job_id, workspace_id)
        REFERENCES public.generation_jobs(id, workspace_id) ON DELETE CASCADE,

    FOREIGN KEY (asset_id, workspace_id)
        REFERENCES public.assets(id, workspace_id) ON DELETE CASCADE,

    UNIQUE (job_id, asset_id)
);

-- ------------------------------------------------------------
-- 6. APPROVALS AND AUDIT EVENTS
-- ------------------------------------------------------------

CREATE TABLE public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    design_version_id UUID NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (design_version_id, workspace_id)
        REFERENCES public.design_versions(id, workspace_id)
        ON DELETE CASCADE
);

CREATE TABLE public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 7. UPDATED_AT TRIGGER
-- ------------------------------------------------------------

CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER brands_updated_at
    BEFORE UPDATE ON public.brand_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER designs_updated_at
    BEFORE UPDATE ON public.designs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER generation_jobs_updated_at
    BEFORE UPDATE ON public.generation_jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER approvals_updated_at
    BEFORE UPDATE ON public.approvals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 8. WORKSPACE ACCESS HELPERS
-- ------------------------------------------------------------

CREATE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = (SELECT auth.uid())
    );
$$;

CREATE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = (SELECT auth.uid())
          AND wm.role IN ('owner', 'admin')
    );
$$;

-- Automatically add the creator as workspace owner.
CREATE FUNCTION public.add_workspace_owner()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');

    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_owner_membership
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner();

-- Keep workspace_members in sync when workspace ownership is transferred:
-- demote the previous owner to admin and promote the new owner to owner.
CREATE FUNCTION public.sync_workspace_owner_change()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        UPDATE public.workspace_members
        SET role = 'admin'
        WHERE workspace_id = NEW.id
          AND user_id = OLD.owner_id
          AND role = 'owner';

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (NEW.id, NEW.owner_id, 'owner')
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET role = 'owner';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_owner_change
    AFTER UPDATE OF owner_id ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_owner_change();

-- ------------------------------------------------------------
-- 9. ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 10. WORKSPACE POLICIES
-- ------------------------------------------------------------

CREATE POLICY workspace_select
ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id));

CREATE POLICY workspace_insert
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY workspace_update
ON public.workspaces FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY workspace_delete
ON public.workspaces FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY member_select
ON public.workspace_members FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Only admins/owners may add members, never as 'owner' (ownership is
-- transferred exclusively via workspaces.owner_id, see
-- sync_workspace_owner_change), and never themselves to avoid
-- self-granted membership rows bypassing the trigger-managed owner slot.
CREATE POLICY member_insert
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
    AND user_id <> (SELECT auth.uid())
);

-- Admins/owners may change roles of existing non-owner members, but may
-- not touch the owner row and may not modify their own membership row
-- (prevents an admin from self-escalating or self-demoting around the
-- owner-only workspace_update policy).
CREATE POLICY member_update
ON public.workspace_members FOR UPDATE TO authenticated
USING (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
    AND user_id <> (SELECT auth.uid())
)
WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
    AND user_id <> (SELECT auth.uid())
);

-- Admins/owners may remove non-owner members, but not the owner row and
-- not themselves (self-removal would strand admin-only permission checks
-- mid-transaction; leaving a workspace should go through a dedicated
-- backend-mediated flow instead).
CREATE POLICY member_delete
ON public.workspace_members FOR DELETE TO authenticated
USING (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
    AND user_id <> (SELECT auth.uid())
);

-- ------------------------------------------------------------
-- 11. WORKSPACE RESOURCE POLICIES
-- ------------------------------------------------------------

CREATE POLICY projects_select
ON public.projects FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY projects_insert
ON public.projects FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY projects_update
ON public.projects FOR UPDATE TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY projects_delete
ON public.projects FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id));

CREATE POLICY brands_select
ON public.brand_profiles FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY brands_insert
ON public.brand_profiles FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY brands_update
ON public.brand_profiles FOR UPDATE TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY brands_delete
ON public.brand_profiles FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id));

CREATE POLICY campaigns_select
ON public.campaigns FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY campaigns_insert
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY campaigns_update
ON public.campaigns FOR UPDATE TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY campaigns_delete
ON public.campaigns FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id));

CREATE POLICY assets_select
ON public.assets FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY assets_insert
ON public.assets FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY assets_update
ON public.assets FOR UPDATE TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY assets_delete
ON public.assets FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id));

CREATE POLICY designs_select
ON public.designs FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY designs_insert
ON public.designs FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY designs_update
ON public.designs FOR UPDATE TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY designs_delete
ON public.designs FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id));

-- Design versions: allow insert and read, but no update/delete policy.
CREATE POLICY versions_select
ON public.design_versions FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY versions_insert
ON public.design_versions FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY generation_jobs_select
ON public.generation_jobs FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY generation_jobs_insert
ON public.generation_jobs FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (requested_by IS NULL OR requested_by = (SELECT auth.uid()))
    AND status = 'queued'
    AND attempt_count = 0
    AND started_at IS NULL
    AND completed_at IS NULL
    AND error_code IS NULL
    AND error_message IS NULL
);

-- Status/progress fields (status, attempt_count, timestamps, error_*)
-- are owned by the trusted backend worker, which uses the service_role
-- key and bypasses RLS entirely. No authenticated-role UPDATE policy
-- is granted on this table, so clients cannot move a job between
-- states or tamper with execution metadata directly.

CREATE POLICY outputs_select
ON public.generation_outputs FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Generation outputs are produced exclusively by the backend worker
-- (service_role) once a job succeeds; no authenticated-role INSERT
-- policy is granted, so clients cannot fabricate output records.

CREATE POLICY approvals_select
ON public.approvals FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Only workspace admins/owners may assign a reviewer and record
-- approval decisions ("authorized administrators"); plain members and
-- viewers are read-only. reviewer_id must identify a real admin/owner
-- of the same workspace, preventing an admin from assigning review
-- authority to an arbitrary, non-privileged user_id.
CREATE POLICY approvals_insert
ON public.approvals FOR INSERT TO authenticated
WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND (
        reviewer_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = approvals.workspace_id
              AND wm.user_id = approvals.reviewer_id
              AND wm.role IN ('owner', 'admin')
        )
    )
);

CREATE POLICY approvals_update
ON public.approvals FOR UPDATE TO authenticated
USING (public.is_workspace_admin(workspace_id))
WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND (
        reviewer_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = approvals.workspace_id
              AND wm.user_id = approvals.reviewer_id
              AND wm.role IN ('owner', 'admin')
        )
    )
);

CREATE POLICY audit_select
ON public.audit_events FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Audit events are append-only and written exclusively by the trusted
-- backend (service_role, bypassing RLS). No authenticated-role INSERT
-- (or UPDATE/DELETE) policy is granted, so clients can never fabricate,
-- alter, or erase audit history.

-- ------------------------------------------------------------
-- 12. LEAST-PRIVILEGE GRANTS
-- ------------------------------------------------------------
-- RLS policies decide which *rows* a role may see or touch; GRANTs
-- decide which *operations* a role may attempt at all. Supabase grants
-- broad default privileges on the public schema to anon/authenticated,
-- so every table below gets an explicit, minimal grant as defense in
-- depth alongside the RLS policies above. anon has no access to any
-- table in this schema.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designs TO authenticated;

-- Design versions are immutable once written: clients may create and
-- read versions, but never update or delete history.
GRANT SELECT, INSERT ON public.design_versions TO authenticated;

-- Clients may enqueue a job and read status, but status/output
-- transitions are backend-only (service_role bypasses RLS and holds
-- its own superuser-level grants, so no explicit grant is needed here).
GRANT SELECT, INSERT ON public.generation_jobs TO authenticated;
GRANT SELECT ON public.generation_outputs TO authenticated;

-- Approvals: admins/owners insert and update (enforced by RLS above);
-- members/viewers only ever need SELECT, which is what the grant and
-- the approvals_select policy both allow.
GRANT SELECT, INSERT, UPDATE ON public.approvals TO authenticated;

-- Audit events are backend-written only; authenticated clients may
-- read their workspace's history but can never insert, update, or
-- delete rows, regardless of RLS.
GRANT SELECT ON public.audit_events TO authenticated;

-- Workspace access-check helpers run as the calling user's privileges
-- would otherwise allow; only authenticated clients need to invoke them
-- (policies call them implicitly, but explicit EXECUTE grants keep the
-- helper functions from being callable by anon or unauthenticated
-- sessions directly).
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;

-- Trigger functions are never invoked directly by client roles; they
-- run solely as the trigger's defining context (SECURITY DEFINER) and
-- need no EXECUTE grant to authenticated/anon.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_workspace_owner() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_workspace_owner_change() FROM authenticated;

-- ------------------------------------------------------------
-- 13. INDEXES
-- ------------------------------------------------------------

CREATE INDEX idx_workspace_members_user
    ON public.workspace_members(user_id);

CREATE INDEX idx_projects_workspace
    ON public.projects(workspace_id);

CREATE INDEX idx_campaigns_project
    ON public.campaigns(project_id);

CREATE INDEX idx_campaigns_workspace
    ON public.campaigns(workspace_id);

CREATE INDEX idx_assets_workspace_created
    ON public.assets(workspace_id, created_at DESC);

CREATE INDEX idx_designs_workspace_updated
    ON public.designs(workspace_id, updated_at DESC);

CREATE INDEX idx_versions_design
    ON public.design_versions(design_id, version_number DESC);

CREATE INDEX idx_generation_jobs_workspace_status
    ON public.generation_jobs(workspace_id, status, created_at DESC);

CREATE INDEX idx_generation_outputs_job
    ON public.generation_outputs(job_id);

CREATE INDEX idx_approvals_workspace_status
    ON public.approvals(workspace_id, status);

CREATE INDEX idx_audit_events_workspace_created
    ON public.audit_events(workspace_id, created_at DESC);

COMMIT;
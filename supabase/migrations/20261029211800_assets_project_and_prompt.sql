-- ============================================================
-- CREATIQ: Link assets to projects, store the generation prompt
-- Migration: 20261029211800_assets_project_and_prompt.sql
-- ============================================================
--
-- Phase 5 (Projects & My Library) needs to group generated assets by
-- project and show the prompt that produced each one. The existing
-- campaign/design/design_version chain is a heavier structure meant
-- for versioned design documents, not a simple "this image belongs to
-- this project" relationship for AI-generated assets. Rather than
-- force generated images through that chain, this adds a direct,
-- nullable project_id to assets (an asset can exist without a
-- project, e.g. ungrouped library items) and a nullable prompt column
-- for assets created from a generation (NULL for uploaded/other
-- assets that were never generated from a prompt).

BEGIN;

ALTER TABLE public.assets
    ADD COLUMN project_id UUID,
    ADD COLUMN prompt TEXT;

ALTER TABLE public.assets
    ADD CONSTRAINT assets_project_same_workspace_fk
    FOREIGN KEY (project_id, workspace_id)
    REFERENCES public.projects(id, workspace_id)
    ON DELETE SET NULL (project_id);

CREATE INDEX idx_assets_workspace_project
    ON public.assets(workspace_id, project_id);

COMMIT;

-- ============================================================
-- CREATIQ: Storage RLS for the creatiq-assets bucket
-- Migration: 20261029211756_storage_rls.sql
-- ============================================================
--
-- The public.assets table tracks file metadata and is already
-- protected by workspace-scoped RLS (see the initial schema
-- migration). This migration adds matching RLS on storage.objects
-- itself, since Supabase Storage is a separate authorization surface:
-- a row in public.assets does not restrict who can read or write the
-- underlying file bytes in the bucket.
--
-- Convention: every object uploaded to creatiq-assets must be stored
-- under a path whose first segment is the owning workspace's id, e.g.
--   <workspace_id>/<filename>
-- storage.foldername(name)[1] extracts that first segment, which is
-- then checked against the caller's workspace membership using the
-- same public.is_workspace_member / public.is_workspace_admin helpers
-- the rest of the schema already relies on.
--
-- Access level mirrors public.assets' own policies: any workspace
-- member may read, upload, or overwrite; only an owner/admin may
-- delete.

BEGIN;

-- Safely extracts the workspace id from an object path's first folder
-- segment. Returns NULL (never raises) for a malformed or missing
-- segment, so a bad path cleanly fails is_workspace_member/_admin
-- rather than erroring the whole RLS check.
CREATE FUNCTION storage.creatiq_asset_workspace_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    folder TEXT;
BEGIN
    folder := (storage.foldername(object_name))[1];

    IF folder IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN folder::uuid;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;

-- Callable by authenticated (RLS policies below run as that role);
-- not needed by anon, since no creatiq-assets policy grants anon access.
GRANT EXECUTE ON FUNCTION storage.creatiq_asset_workspace_id(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION storage.creatiq_asset_workspace_id(TEXT) FROM anon, PUBLIC;

CREATE POLICY creatiq_assets_select
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'creatiq-assets'
    AND public.is_workspace_member(
        storage.creatiq_asset_workspace_id(name)
    )
);

CREATE POLICY creatiq_assets_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'creatiq-assets'
    AND public.is_workspace_member(
        storage.creatiq_asset_workspace_id(name)
    )
);

CREATE POLICY creatiq_assets_update
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'creatiq-assets'
    AND public.is_workspace_member(
        storage.creatiq_asset_workspace_id(name)
    )
)
WITH CHECK (
    bucket_id = 'creatiq-assets'
    AND public.is_workspace_member(
        storage.creatiq_asset_workspace_id(name)
    )
);

CREATE POLICY creatiq_assets_delete
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'creatiq-assets'
    AND public.is_workspace_admin(
        storage.creatiq_asset_workspace_id(name)
    )
);

COMMIT;

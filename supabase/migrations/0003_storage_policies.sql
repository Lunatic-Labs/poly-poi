-- Storage RLS policies for tenant-assets bucket
--
-- Uploads come directly from the browser using the user's JWT, so RLS applies.
-- Path structure: {tenant_id}/logo/logo.{ext}
-- We verify ownership by checking admin_profiles for the authenticated user.

-- Public reads (bucket is public, but RLS still requires a SELECT policy)
CREATE POLICY "Public read tenant assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

-- Authenticated admins can upload (INSERT) into their own tenant folder
CREATE POLICY "Admins can upload to their tenant folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM admin_profiles WHERE id = auth.uid()
  )
);

-- Authenticated admins can overwrite (UPDATE) files in their own tenant folder
-- Required because the upload uses upsert: true
CREATE POLICY "Admins can update their tenant folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM admin_profiles WHERE id = auth.uid()
  )
);

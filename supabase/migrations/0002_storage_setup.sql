-- Create the tenant-assets storage bucket for logo uploads
-- This bucket is public (logos are served as public URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO NOTHING;

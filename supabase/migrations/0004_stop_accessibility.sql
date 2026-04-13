-- Add accessibility flag to stops
ALTER TABLE stops ADD COLUMN is_accessible BOOLEAN NOT NULL DEFAULT false;

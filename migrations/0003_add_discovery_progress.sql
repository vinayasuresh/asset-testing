-- Add progress tracking fields to discovery_jobs table

ALTER TABLE discovery_jobs 
ADD COLUMN IF NOT EXISTS progress_message TEXT,
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0;

-- Update existing jobs to have 0% progress
UPDATE discovery_jobs 
SET progress_percent = 0 
WHERE progress_percent IS NULL;

-- Add notify_on_incomplete column to tasks table
ALTER TABLE tasks ADD COLUMN notify_on_incomplete BOOLEAN DEFAULT false;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tasks.notify_on_incomplete IS 'Whether to notify all household members when this task is not completed on time';

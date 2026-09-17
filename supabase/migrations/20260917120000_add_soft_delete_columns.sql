-- Add deleted_at for soft-delete to tables that currently hard-delete.
-- For a DV evidence app, accidental permanent deletion is unacceptable.
-- Matches the pattern already used by incidents and evidence tables.

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE voice_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE message_threads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE legal_documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_communications_deleted_at ON communications (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voice_notes_deleted_at ON voice_notes (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_threads_deleted_at ON message_threads (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_legal_documents_deleted_at ON legal_documents (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at ON recordings (deleted_at) WHERE deleted_at IS NULL;

-- Add rejected status and NLU suggestion to pending_modifications
ALTER TABLE pending_modifications
  ADD COLUMN IF NOT EXISTS rejected          boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejected_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by       text,
  ADD COLUMN IF NOT EXISTS nlu_product_code  text;

-- Policy already covers all ops via allow_all_mods

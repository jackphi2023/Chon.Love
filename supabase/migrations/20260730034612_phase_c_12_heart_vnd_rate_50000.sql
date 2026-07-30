-- Phase C / Session 12 business-rule correction.
-- Future top-up and withdrawal conversion: 1 heart = 50,000 VND.
-- Historical transaction snapshots are intentionally not modified.

update private.app_config
set value_json = to_jsonb(50000),
    value_type = 'integer',
    is_public = true,
    updated_at = now()
where key = 'heart_vnd_rate';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM private.app_config
    WHERE key = 'heart_vnd_rate'
      AND value_json = to_jsonb(50000)
      AND value_type = 'integer'
      AND is_public
  ) THEN
    RAISE EXCEPTION 'heart_vnd_rate was not updated to 50000';
  END IF;
END
$$;

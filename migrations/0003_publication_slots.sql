-- 0003_publication_slots.sql
-- Publication date scheduling: advertisers propose dates, publishers approve
-- or adjust against their availability — fully visible to both parties.

CREATE TABLE IF NOT EXISTS publication_slots (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  slot_date TEXT NOT NULL,             -- YYYY-MM-DD
  slot_time TEXT,                      -- HH:MM (optional)
  status TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','APPROVED','ADJUSTED','REJECTED','PUBLISHED')),
  proposed_by TEXT NOT NULL,           -- advertiser | publisher | agency
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_slots_booking ON publication_slots(booking_id);

-- Video / cloud links (Google Drive etc.) attached to a creative
ALTER TABLE creatives ADD COLUMN drive_links TEXT;

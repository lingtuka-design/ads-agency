-- 0001_init.sql — Advertising Agency Marketplace core schema
-- Cloudflare D1 / SQLite-compatible.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','publisher','advertiser')),
  account_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (account_status IN ('PENDING','ACTIVE','VERIFICATION_REQUIRED','SUSPENDED','BLOCKED')),
  avatar_url TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  staff_role TEXT NOT NULL
    CHECK (staff_role IN ('SUPER_ADMIN','FINANCE_ADMIN','CAMPAIGN_MANAGER','CREATIVE_MANAGER','SUPPORT_STAFF','CONTENT_MANAGER')),
  title TEXT,
  bio TEXT,
  photo_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS advertisers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  company_name TEXT,
  industry TEXT,
  location TEXT,
  description TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  cover_url TEXT,
  description TEXT,
  category TEXT,
  location TEXT,
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  social_links TEXT,
  about TEXT,
  advertising_policies TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','INFO_REQUIRED','APPROVED','REJECTED','SUSPENDED','ACTIVE')),
  trust_level TEXT NOT NULL DEFAULT 'REGISTERED'
    CHECK (trust_level IN ('REGISTERED','VERIFIED','PREMIUM','FEATURED')),
  verified INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  rejected_reason TEXT,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_publishers_status ON publishers(status);
CREATE INDEX IF NOT EXISTS idx_publishers_category ON publishers(category);

CREATE TABLE IF NOT EXISTS publisher_stats (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL UNIQUE REFERENCES publishers(id),
  platform TEXT NOT NULL DEFAULT 'OTHER'
    CHECK (platform IN ('INSTAGRAM','FACEBOOK','YOUTUBE','WEBSITE','NEWSPAPER','TELEVISION','RADIO','DIGITAL_MAGAZINE','OUTDOOR','OTHER')),
  platform_url TEXT,
  followers INTEGER NOT NULL DEFAULT 0,
  subscribers INTEGER,
  monthly_visitors INTEGER,
  monthly_page_views INTEGER,
  avg_views INTEGER,
  avg_reach INTEGER,
  engagement_rate REAL,
  avg_post_views INTEGER,
  avg_story_views INTEGER,
  avg_video_views INTEGER,
  audience_location TEXT,
  audience_age_group TEXT,
  gender_distribution TEXT,
  primary_age_group TEXT,
  extra_notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS ad_packages (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  title TEXT NOT NULL,
  platform TEXT NOT NULL
    CHECK (platform IN ('INSTAGRAM','FACEBOOK','YOUTUBE','WEBSITE','NEWSPAPER','TELEVISION','RADIO','DIGITAL_MAGAZINE','OUTDOOR','OTHER')),
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  quantity INTEGER NOT NULL DEFAULT 1,
  duration_days INTEGER NOT NULL DEFAULT 30,
  total_slots INTEGER NOT NULL DEFAULT 1,
  booked_slots INTEGER NOT NULL DEFAULT 0,
  reserved_slots INTEGER NOT NULL DEFAULT 0,
  availability_start TEXT,
  availability_end TEXT,
  blackout_dates TEXT,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  creative_specs TEXT,
  requirements TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_packages_publisher ON ad_packages(publisher_id);
CREATE INDEX IF NOT EXISTS idx_packages_platform ON ad_packages(platform);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id),
  name TEXT NOT NULL,
  objective TEXT,
  product_service TEXT,
  target_audience TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  package_id TEXT NOT NULL REFERENCES ad_packages(id),
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PENDING_PAYMENT','PAID','UNDER_REVIEW','CREATIVE_REQUIRED','CREATIVE_APPROVED','SENT_TO_PUBLISHER','PUBLISHER_APPROVED','SCHEDULED','LIVE','PROOF_SUBMITTED','COMPLETED','CANCELLED','REFUNDED','DISPUTED')),
  scheduled_start TEXT,
  scheduled_end TEXT,
  instructions TEXT,
  finance TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_package ON bookings(package_id);
CREATE INDEX IF NOT EXISTS idx_bookings_publisher ON bookings(publisher_id);
CREATE INDEX IF NOT EXISTS idx_bookings_advertiser ON bookings(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_bookings_campaign ON bookings(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_booking_history ON booking_status_history(booking_id);

CREATE TABLE IF NOT EXISTS creatives (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  current_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','UPLOADED','UNDER_AGENCY_REVIEW','CHANGES_REQUESTED','APPROVED_BY_AGENCY','SENT_TO_PUBLISHER','PUBLISHER_REVIEW','PUBLISHER_APPROVED','SCHEDULED','PUBLISHED','COMPLETED','REJECTED','CANCELLED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS creative_versions (
  id TEXT PRIMARY KEY,
  creative_id TEXT NOT NULL REFERENCES creatives(id),
  version INTEGER NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_creative_versions ON creative_versions(creative_id);

CREATE TABLE IF NOT EXISTS creative_jobs (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id),
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'NEW_REQUEST'
    CHECK (status IN ('NEW_REQUEST','ASSIGNED','DESIGNING','REVIEW','REVISION_REQUESTED','FINAL_APPROVAL','APPROVED','DELIVERED')),
  brief TEXT,
  business_name TEXT,
  product_service TEXT,
  objective TEXT,
  target_audience TEXT,
  preferred_style TEXT,
  preferred_colors TEXT,
  required_text TEXT,
  format TEXT,
  budget REAL,
  deadline TEXT,
  attachments TEXT,
  drive_links TEXT,
  design_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_creative_jobs_adv ON creative_jobs(advertiser_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('campaign','creative_job','dispute','support')),
  thread_id TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  body TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_type, thread_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','INITIATED','SUCCESSFUL','FAILED','REFUNDED','PARTIALLY_REFUNDED','SETTLEMENT_PENDING','PUBLISHER_PAID','SETTLEMENT_FAILED')),
  method TEXT,
  provider TEXT,
  provider_ref TEXT,
  provider_payload TEXT,
  invoice_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  event TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_events ON payment_events(payment_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  amount REAL NOT NULL,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','PAID','FAILED','CANCELLED')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT,
  payout_ref TEXT,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_settlements_publisher ON settlements(publisher_id);

CREATE TABLE IF NOT EXISTS settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES settlements(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  amount REAL NOT NULL,
  commission_amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  raised_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','CLOSED')),
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_disputes_booking ON disputes(booking_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  publisher_id TEXT,
  package_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique
  ON favorites(user_id, COALESCE(publisher_id,''), COALESCE(package_id,''));

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id),
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  communication INTEGER NOT NULL,
  reliability INTEGER NOT NULL,
  execution INTEGER NOT NULL,
  overall INTEGER NOT NULL,
  comment TEXT,
  moderated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS cms_content (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_uploads_owner ON uploads(owner_id);

CREATE TABLE IF NOT EXISTS publisher_payout_info (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL UNIQUE REFERENCES publishers(id),
  account_holder TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc TEXT,
  upi TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS publisher_reviews_aggregate (
  publisher_id TEXT PRIMARY KEY,
  review_count INTEGER NOT NULL DEFAULT 0,
  avg_communication REAL NOT NULL DEFAULT 0,
  avg_reliability REAL NOT NULL DEFAULT 0,
  avg_execution REAL NOT NULL DEFAULT 0,
  avg_overall REAL NOT NULL DEFAULT 0
);

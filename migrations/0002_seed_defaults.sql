-- 0002_seed_defaults.sql — default system settings and commission configuration

INSERT OR IGNORE INTO system_settings (key, value) VALUES
  ('commission.global.percent', '10'),
  ('commission.global.fixedFee', '0'),
  ('commission.taxPercent', '0'),
  ('inventory.reservation_minutes', '30'),
  ('invoice.prefix', 'INV'),
  ('booking.auto_cancel_after_minutes', '1440'),
  ('app.currency', 'INR'),
  ('agency.name', 'Ad Agency Marketplace'),
  ('agency.legal_name', ''),
  ('agency.registration', ''),
  ('agency.address', ''),
  ('agency.email', 'hello@example.com'),
  ('agency.phone', ''),
  ('agency.gst', '');

import type {
  AccountStatus,
  BookingStatus,
  CreativeJobStatus,
  CreativeStatus,
  DisputeReason,
  DisputeStatus,
  MediaType,
  PaymentMethod,
  PaymentStatus,
  PublisherStatus,
  PublisherTrust,
  Role,
  SettlementStatus,
  StaffRole,
} from "./constants";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  role: Role;
  account_status: AccountStatus;
  avatar_url: string | null;
  must_change_password: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffRow {
  id: string;
  user_id: string;
  staff_role: StaffRole;
  bio: string | null;
  title: string | null;
  photo_url: string | null;
  active: number;
  created_at: string;
}

export interface PublisherRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  social_links: string | null; // JSON
  about: string | null;
  advertising_policies: string | null;
  status: PublisherStatus;
  trust_level: PublisherTrust;
  verified: number;
  rejected_reason: string | null;
  joined_at: string;
  featured: number;
  created_at: string;
  updated_at: string;
}

export interface PublisherStatsRow {
  id: string;
  publisher_id: string;
  platform: MediaType;
  platform_url: string | null;
  followers: number;
  subscribers: number | null;
  monthly_visitors: number | null;
  monthly_page_views: number | null;
  avg_views: number | null;
  avg_reach: number | null;
  engagement_rate: number | null;
  avg_post_views: number | null;
  avg_story_views: number | null;
  avg_video_views: number | null;
  audience_location: string | null;
  audience_age_group: string | null;
  gender_distribution: string | null; // JSON {male, female, other}
  primary_age_group: string | null;
  extra_notes: string | null;
  updated_at: string;
}

export interface AdPackageRow {
  id: string;
  publisher_id: string;
  title: string;
  platform: MediaType;
  description: string | null;
  price: number;
  currency: string;
  quantity: number; // e.g. 10 stories
  duration_days: number;
  total_slots: number;
  booked_slots: number;
  reserved_slots: number;
  availability_start: string | null;
  availability_end: string | null;
  blackout_dates: string | null; // JSON array
  daily_limit: number | null;
  monthly_limit: number | null;
  creative_specs: string | null; // JSON
  requirements: string | null;
  is_active: number;
  is_featured: number;
  created_at: string;
  updated_at: string;
}

export interface AdvertiserRow {
  id: string;
  user_id: string;
  company_name: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  verified: number;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  advertiser_id: string;
  name: string;
  objective: string | null;
  product_service: string | null;
  target_audience: string | null;
  start_date: string;
  end_date: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  campaign_id: string;
  package_id: string;
  publisher_id: string;
  advertiser_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  currency: string;
  status: BookingStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  instructions: string | null;
  finance: string | null; // JSON CommissionSnapshot
  created_at: string;
  updated_at: string;
}

export interface BookingHistoryRow {
  id: string;
  booking_id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CreativeRow {
  id: string;
  booking_id: string;
  current_version: number;
  status: CreativeStatus;
  created_at: string;
  updated_at: string;
}

export interface CreativeVersionRow {
  id: string;
  creative_id: string;
  version: number;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  status: CreativeStatus;
  comment: string | null;
  created_at: string;
}

export interface CreativeJobRow {
  id: string;
  advertiser_id: string;
  assigned_to: string | null;
  status: CreativeJobStatus;
  brief: string | null;
  budget: number | null;
  deadline: string | null;
  attachments: string | null; // JSON
  drive_links: string | null; // JSON
  design_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  thread_type: string; // campaign | creative_job | dispute | support
  thread_id: string;
  sender_id: string;
  sender_role: Role | StaffRole;
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  is_system: number;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  booking_id: string;
  advertiser_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  provider: string | null;
  provider_ref: string | null;
  provider_payload: string | null; // JSON
  invoice_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentEventRow {
  id: string;
  payment_id: string;
  event: string;
  payload: string | null;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  number: string;
  payment_id: string;
  advertiser_id: string;
  booking_id: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  pdf_url: string | null;
  status: string;
  created_at: string;
}

export interface SettlementRow {
  id: string;
  publisher_id: string;
  status: SettlementStatus;
  amount: number;
  currency: string;
  method: string | null;
  payout_ref: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementItemRow {
  id: string;
  settlement_id: string;
  booking_id: string;
  amount: number;
  commission_amount: number;
}

export interface DisputeRow {
  id: string;
  booking_id: string;
  raised_by: string;
  reason: DisputeReason;
  description: string | null;
  status: DisputeStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: number;
  created_at: string;
}

export interface FavoriteRow {
  id: string;
  user_id: string;
  publisher_id: string | null;
  package_id: string | null;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  booking_id: string;
  advertiser_id: string;
  publisher_id: string;
  communication: number;
  reliability: number;
  execution: number;
  overall: number;
  comment: string | null;
  moderated: number;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  ip: string | null;
  created_at: string;
}

export interface SystemSettingRow {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export interface CmsContentRow {
  key: string;
  content: string; // JSON
  updated_by: string | null;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked: number;
}

export interface UploadRow {
  id: string;
  owner_id: string;
  bucket: string;
  key: string;
  file_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

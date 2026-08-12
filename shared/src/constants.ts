export const ROLES = {
  ADMIN: "admin",
  PUBLISHER: "publisher",
  ADVERTISER: "advertiser",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "CAMPAIGN_MANAGER",
  "CREATIVE_MANAGER",
  "SUPPORT_STAFF",
  "CONTENT_MANAGER",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PERMISSIONS: Record<StaffRole, string[]> = {
  SUPER_ADMIN: ["*"],
  FINANCE_ADMIN: [
    "payments.view",
    "payments.manage",
    "settlements.view",
    "settlements.manage",
    "invoices.view",
    "invoices.manage",
    "commission.view",
    "commission.manage",
    "reports.view",
    "audit.view",
  ],
  CAMPAIGN_MANAGER: [
    "campaigns.view",
    "campaigns.manage",
    "bookings.view",
    "bookings.manage",
    "publishers.view",
    "publishers.manage",
    "advertisers.view",
    "messages.view",
  ],
  CREATIVE_MANAGER: [
    "creative.view",
    "creative.manage",
    "files.view",
    "messages.view",
  ],
  SUPPORT_STAFF: [
    "campaigns.view",
    "bookings.view",
    "disputes.view",
    "disputes.manage",
    "messages.view",
    "advertisers.view",
    "publishers.view",
  ],
  CONTENT_MANAGER: [
    "cms.view",
    "cms.manage",
    "publishers.view",
    "content.view",
  ],
};

export const PUBLISHER_STATUS = [
  "PENDING",
  "INFO_REQUIRED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "ACTIVE",
] as const;
export type PublisherStatus = (typeof PUBLISHER_STATUS)[number];

export const PUBLISHER_TRUST = [
  "REGISTERED",
  "VERIFIED",
  "PREMIUM",
  "FEATURED",
] as const;
export type PublisherTrust = (typeof PUBLISHER_TRUST)[number];

export const MEDIA_TYPES = [
  "INSTAGRAM",
  "FACEBOOK",
  "YOUTUBE",
  "WEBSITE",
  "NEWSPAPER",
  "TELEVISION",
  "RADIO",
  "DIGITAL_MAGAZINE",
  "OUTDOOR",
  "OTHER",
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const BOOKING_STATUS = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "UNDER_REVIEW",
  "CREATIVE_REQUIRED",
  "CREATIVE_APPROVED",
  "SENT_TO_PUBLISHER",
  "PUBLISHER_APPROVED",
  "SCHEDULED",
  "LIVE",
  "PROOF_SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DISPUTED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUS)[number];

export const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  BookingStatus[]
> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED", "DISPUTED"],
  PAID: ["UNDER_REVIEW", "CREATIVE_REQUIRED", "CANCELLED", "DISPUTED", "REFUNDED"],
  UNDER_REVIEW: ["CREATIVE_REQUIRED", "CREATIVE_APPROVED", "SENT_TO_PUBLISHER", "DISPUTED"],
  CREATIVE_REQUIRED: ["CREATIVE_APPROVED", "UNDER_REVIEW", "CANCELLED", "DISPUTED"],
  CREATIVE_APPROVED: ["SENT_TO_PUBLISHER", "UNDER_REVIEW", "DISPUTED"],
  SENT_TO_PUBLISHER: ["PUBLISHER_APPROVED", "SCHEDULED", "DISPUTED", "CANCELLED"],
  PUBLISHER_APPROVED: ["SCHEDULED", "SENT_TO_PUBLISHER", "DISPUTED"],
  SCHEDULED: ["LIVE", "DISPUTED", "CANCELLED"],
  LIVE: ["PROOF_SUBMITTED", "COMPLETED", "DISPUTED"],
  PROOF_SUBMITTED: ["COMPLETED", "LIVE", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: ["REFUNDED", "DISPUTED"],
  REFUNDED: ["DISPUTED"],
  DISPUTED: ["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "REFUNDED"],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CREATIVE_STATUS = [
  "DRAFT",
  "UPLOADED",
  "UNDER_AGENCY_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED_BY_AGENCY",
  "SENT_TO_PUBLISHER",
  "PUBLISHER_REVIEW",
  "PUBLISHER_APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
export type CreativeStatus = (typeof CREATIVE_STATUS)[number];

export const CREATIVE_JOB_STATUS = [
  "NEW_REQUEST",
  "ASSIGNED",
  "DESIGNING",
  "REVIEW",
  "REVISION_REQUESTED",
  "FINAL_APPROVAL",
  "APPROVED",
  "DELIVERED",
] as const;
export type CreativeJobStatus = (typeof CREATIVE_JOB_STATUS)[number];

export const PAYMENT_STATUS = [
  "PENDING",
  "INITIATED",
  "SUCCESSFUL",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "SETTLEMENT_PENDING",
  "PUBLISHER_PAID",
  "SETTLEMENT_FAILED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_METHODS = [
  "UPI",
  "CARD",
  "NET_BANKING",
  "WALLET",
  "MANUAL",
  "BANK_TRANSFER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SETTLEMENT_STATUS = [
  "PENDING",
  "APPROVED",
  "PAID",
  "FAILED",
  "CANCELLED",
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUS)[number];

export const DISPUTE_STATUS = ["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUS)[number];

export const DISPUTE_REASONS = [
  "ADVERTISEMENT_NOT_PUBLISHED",
  "WRONG_CREATIVE_PUBLISHED",
  "LATE_PUBLICATION",
  "INCORRECT_PLACEMENT",
  "CAMPAIGN_NOT_COMPLETED",
  "PUBLISHER_CANCELLED",
  "ADVERTISER_SUBMITTED_INCORRECT_MATERIAL",
  "PAYMENT_ISSUE",
  "CREATIVE_ISSUE",
  "OTHER",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const ACCOUNT_STATUS = [
  "PENDING",
  "ACTIVE",
  "VERIFICATION_REQUIRED",
  "SUSPENDED",
  "BLOCKED",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[number];

export const NOTIFICATION_TYPES = [
  "BOOKING_CREATED",
  "PAYMENT_SUCCESSFUL",
  "PAYMENT_FAILED",
  "CREATIVE_UPLOADED",
  "REVISION_REQUESTED",
  "CREATIVE_APPROVED",
  "PUBLISHER_NOTIFIED",
  "CAMPAIGN_SCHEDULED",
  "CAMPAIGN_PUBLISHED",
  "CAMPAIGN_COMPLETED",
  "SETTLEMENT_CREATED",
  "SETTLEMENT_PAID",
  "DISPUTE_CREATED",
  "MESSAGE",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CURRENCY = "INR";

export function formatMoney(amount: number, currency: string = CURRENCY): string {
  if (currency === "INR") {
    return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export const FILE_ACCEPTED = {
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
  DOCUMENT: ["application/pdf"],
  VIDEO: ["video/mp4", "video/quicktime"],
} as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface CommissionSnapshot {
  originalPrice: number;
  discount: number;
  tax: number;
  grossAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  publisherAmount: number;
  netAgencyAmount: number;
  currency: string;
}

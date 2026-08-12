import type { Env } from "../env";
import { ApiError } from "../utils";
import { computeInventory, inventoryStatus } from "@agency/shared";

export interface PackageRowLite {
  id: string;
  publisher_id: string;
  total_slots: number;
  booked_slots: number;
  reserved_slots: number;
  is_active: number;
}

export async function loadPackage(env: Env, packageId: string): Promise<PackageRowLite | null> {
  return env.DB.prepare(
    `SELECT id, publisher_id, total_slots, booked_slots, reserved_slots, is_active
     FROM ad_packages WHERE id = ?`,
  )
    .bind(packageId)
    .first<PackageRowLite>();
}

/**
 * Reserve inventory for a checkout. Returns the new reserved count.
 * Uses a transaction so two simultaneous checkouts cannot reserve the
 * final slot (spec §6, §72).
 */
export async function reserveSlots(env: Env, packageId: string, quantity = 1): Promise<number> {
  const res = await env.DB.prepare(
    `UPDATE ad_packages SET reserved_slots = reserved_slots + ?
     WHERE id = ? AND is_active = 1
       AND (total_slots - booked_slots - reserved_slots) >= ?`,
  )
    .bind(quantity, packageId, quantity)
    .run();
  if (res.meta.changes === 0) {
    const exists = await env.DB.prepare(`SELECT id FROM ad_packages WHERE id = ?`).bind(packageId).first();
    if (!exists) throw new ApiError(404, "PACKAGE_NOT_FOUND", "Package not found.");
    throw new ApiError(
      409,
      "NO_INVENTORY",
      "The selected advertising slot was just booked by another advertiser. Please choose another available slot.",
    );
  }
  const row = await env.DB.prepare(`SELECT reserved_slots FROM ad_packages WHERE id = ?`)
    .bind(packageId)
    .first<{ reserved_slots: number }>();
  return row?.reserved_slots ?? 0;
}

export async function releaseReservation(env: Env, packageId: string, quantity = 1): Promise<void> {
  await env.DB.prepare(
    `UPDATE ad_packages SET reserved_slots = MAX(0, reserved_slots - ?) WHERE id = ?`,
  )
    .bind(quantity, packageId)
    .run();
}

/** Finalize a booking into inventory (transactional). */
export async function confirmBookingInventory(env: Env, packageId: string, quantity = 1): Promise<void> {
  const res = await env.DB.prepare(
    `UPDATE ad_packages
       SET reserved_slots = MAX(0, reserved_slots - ?),
           booked_slots = booked_slots + ?
     WHERE id = ? AND (booked_slots + ?) <= total_slots`,
  )
    .bind(quantity, quantity, packageId, quantity)
    .run();
  if (res.meta.changes === 0) {
    throw new ApiError(409, "OVERBOOKED", "This package can no longer accept bookings.");
  }
}

export async function releaseBookedInventory(env: Env, packageId: string, quantity = 1): Promise<void> {
  await env.DB.prepare(
    `UPDATE ad_packages SET booked_slots = MAX(0, booked_slots - ?) WHERE id = ?`,
  )
    .bind(quantity, packageId)
    .run();
}

export function packageAvailability(pkg: PackageRowLite): string {
  return inventoryStatus(computeInventory(pkg.total_slots, pkg.booked_slots, pkg.reserved_slots));
}

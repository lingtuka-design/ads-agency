/**
 * Inventory slot logic (spec §6).
 * A package defines total slots; bookings reserve them transactionally.
 * Slots can be reserved (checkout in progress) and released when payment
 * is abandoned (spec §72).
 */

export type InventoryStatus = "AVAILABLE" | "LOW" | "SOLD_OUT" | "PAUSED";

export interface PackageInventory {
  totalSlots: number;
  bookedSlots: number;
  reservedSlots: number;
  availableSlots: number;
}

export function computeInventory(
  totalSlots: number,
  bookedSlots: number,
  reservedSlots: number,
): PackageInventory {
  const availableSlots = Math.max(0, totalSlots - bookedSlots - reservedSlots);
  return { totalSlots, bookedSlots, reservedSlots, availableSlots };
}

export function inventoryStatus(inv: PackageInventory): InventoryStatus {
  if (inv.totalSlots <= 0) return "SOLD_OUT";
  if (inv.availableSlots === 0) return "SOLD_OUT";
  if (inv.availableSlots <= Math.ceil(inv.totalSlots * 0.2)) return "LOW";
  return "AVAILABLE";
}

export function canReserve(inv: PackageInventory, quantity = 1): boolean {
  return inv.availableSlots >= quantity;
}

export interface BlackoutCheck {
  startDate: string;
  endDate: string;
  blackoutDates: string[]; // YYYY-MM-DD
  availableFrom: string | null;
  availableTo: string | null;
}

/** Returns true when a booking overlaps a blackout or falls outside availability window. */
export function isDateConflict(check: BlackoutCheck): boolean {
  const { startDate, endDate, blackoutDates, availableFrom, availableTo } = check;
  if (startDate > endDate) return true;
  if (availableFrom && startDate < availableFrom) return true;
  if (availableTo && endDate > availableTo) return true;

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  for (const b of blackoutDates) {
    const t = new Date(b).getTime();
    if (!isNaN(t) && t >= start && t <= end) return true;
  }
  return false;
}

export function isDateInRange(date: string, from: string, to: string): boolean {
  const t = new Date(date).getTime();
  return t >= new Date(from).getTime() && t <= new Date(to).getTime();
}

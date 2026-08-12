import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { PublicLayout } from "./layouts/PublicLayout";
import { AppLayout } from "./layouts/AppLayout";
import { AdminLayout } from "./layouts/AdminLayout";

import { HomePage } from "./pages/Home";
import { MarketplacePage } from "./pages/Marketplace";
import { PublisherProfilePage } from "./pages/PublisherProfile";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";

import { AdvDashboardPage } from "./pages/adv/Dashboard";
import { AdvBrowsePage } from "./pages/adv/Browse";
import { AdvAssistantPage } from "./pages/adv/Assistant";
import { AdvCampaignsPage } from "./pages/adv/Campaigns";
import { AdvCampaignDetailPage } from "./pages/adv/CampaignDetail";
import { AdvBookingsPage } from "./pages/adv/Bookings";
import { AdvBookingDetailPage } from "./pages/adv/BookingDetail";
import { AdvCreativeStudioPage } from "./pages/adv/CreativeStudio";
import { AdvCreativeJobPage } from "./pages/adv/CreativeJob";
import { AdvMessagesPage } from "./pages/adv/Messages";
import { AdvFilesPage } from "./pages/adv/Files";
import { AdvPaymentsPage } from "./pages/adv/Payments";
import { AdvInvoicesPage } from "./pages/adv/Invoices";
import { AdvShortlistPage } from "./pages/adv/Shortlist";
import { AdvSettingsPage } from "./pages/adv/Settings";

import { PubDashboardPage } from "./pages/pub/Dashboard";
import { PubPackagesPage } from "./pages/pub/Packages";
import { PubBookingsPage } from "./pages/pub/Bookings";
import { PubBookingDetailPage } from "./pages/pub/BookingDetail";
import { PubEarningsPage } from "./pages/pub/Earnings";
import { PubProfilePage } from "./pages/pub/Profile";
import { PubMessagesPage } from "./pages/pub/Messages";

import { AdmOverviewPage } from "./pages/admin/Overview";
import { AdmPublishersPage } from "./pages/admin/Publishers";
import { AdmAdvertisersPage } from "./pages/admin/Advertisers";
import { AdmBookingsPage } from "./pages/admin/Bookings";
import { AdmBookingDetailPage } from "./pages/admin/BookingDetail";
import { AdmPaymentsPage } from "./pages/admin/Payments";
import { AdmSettlementsPage } from "./pages/admin/Settlements";
import { AdmCreativeStudioPage } from "./pages/admin/CreativeStudio";
import { AdmDisputesPage } from "./pages/admin/Disputes";
import { AdmReportsPage } from "./pages/admin/Reports";
import { AdmAuditPage } from "./pages/admin/Audit";
import { AdmSettingsPage } from "./pages/admin/Settings";
import { AdmStaffPage } from "./pages/admin/Staff";

const rootRoute = createRootRoute();

function withPublic(Component: () => React.JSX.Element) {
  return function PublicWrapped() {
    return (
      <PublicLayout>
        <Component />
      </PublicLayout>
    );
  };
}

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: withPublic(HomePage) });
const marketplaceRoute = createRoute({ getParentRoute: () => rootRoute, path: "/publishers", component: withPublic(MarketplacePage) });
const publisherProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/publishers/$slug", component: withPublic(PublisherProfilePage) });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: withPublic(LoginPage) });
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/register", component: withPublic(RegisterPage) });

/* ---------- advertiser ---------- */
const advRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/advertiser",
  component: AppLayout,
});
const advIndex = createRoute({ getParentRoute: () => advRoute, path: "/dashboard", component: AdvDashboardPage });
const advBrowse = createRoute({ getParentRoute: () => advRoute, path: "/publishers", component: AdvBrowsePage });
const advAssistant = createRoute({ getParentRoute: () => advRoute, path: "/assistant", component: AdvAssistantPage });
const advCampaigns = createRoute({ getParentRoute: () => advRoute, path: "/campaigns", component: AdvCampaignsPage });
const advCampaignDetail = createRoute({ getParentRoute: () => advRoute, path: "/campaigns/$id", component: AdvCampaignDetailPage });
const advBookings = createRoute({ getParentRoute: () => advRoute, path: "/bookings", component: AdvBookingsPage });
const advBookingDetail = createRoute({ getParentRoute: () => advRoute, path: "/bookings/$id", component: AdvBookingDetailPage });
const advCreativeStudio = createRoute({ getParentRoute: () => advRoute, path: "/creative-studio", component: AdvCreativeStudioPage });
const advCreativeJob = createRoute({ getParentRoute: () => advRoute, path: "/creative-studio/$id", component: AdvCreativeJobPage });
const advMessages = createRoute({ getParentRoute: () => advRoute, path: "/messages", component: AdvMessagesPage });
const advFiles = createRoute({ getParentRoute: () => advRoute, path: "/files", component: AdvFilesPage });
const advPayments = createRoute({ getParentRoute: () => advRoute, path: "/payments", component: AdvPaymentsPage });
const advInvoices = createRoute({ getParentRoute: () => advRoute, path: "/invoices", component: AdvInvoicesPage });
const advShortlist = createRoute({ getParentRoute: () => advRoute, path: "/shortlist", component: AdvShortlistPage });
const advSettings = createRoute({ getParentRoute: () => advRoute, path: "/settings", component: AdvSettingsPage });

/* ---------- publisher ---------- */
const pubRoute = createRoute({ getParentRoute: () => rootRoute, path: "/publisher", component: AppLayout });
const pubIndex = createRoute({ getParentRoute: () => pubRoute, path: "/dashboard", component: PubDashboardPage });
const pubPackages = createRoute({ getParentRoute: () => pubRoute, path: "/packages", component: PubPackagesPage });
const pubBookings = createRoute({ getParentRoute: () => pubRoute, path: "/bookings", component: PubBookingsPage });
const pubBookingDetail = createRoute({ getParentRoute: () => pubRoute, path: "/bookings/$id", component: PubBookingDetailPage });
const pubEarnings = createRoute({ getParentRoute: () => pubRoute, path: "/earnings", component: PubEarningsPage });
const pubProfile = createRoute({ getParentRoute: () => pubRoute, path: "/profile", component: PubProfilePage });
const pubMessages = createRoute({ getParentRoute: () => pubRoute, path: "/messages", component: PubMessagesPage });

/* ---------- admin ---------- */
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin", component: AdminLayout });
const admIndex = createRoute({ getParentRoute: () => adminRoute, path: "/", component: AdmOverviewPage });
const admPublishers = createRoute({ getParentRoute: () => adminRoute, path: "/publishers", component: AdmPublishersPage });
const admAdvertisers = createRoute({ getParentRoute: () => adminRoute, path: "/advertisers", component: AdmAdvertisersPage });
const admBookings = createRoute({ getParentRoute: () => adminRoute, path: "/bookings", component: AdmBookingsPage });
const admBookingDetail = createRoute({ getParentRoute: () => adminRoute, path: "/bookings/$id", component: AdmBookingDetailPage });
const admPayments = createRoute({ getParentRoute: () => adminRoute, path: "/payments", component: AdmPaymentsPage });
const admSettlements = createRoute({ getParentRoute: () => adminRoute, path: "/settlements", component: AdmSettlementsPage });
const admCreativeStudio = createRoute({ getParentRoute: () => adminRoute, path: "/creative-studio", component: AdmCreativeStudioPage });
const admDisputes = createRoute({ getParentRoute: () => adminRoute, path: "/disputes", component: AdmDisputesPage });
const admReports = createRoute({ getParentRoute: () => adminRoute, path: "/reports", component: AdmReportsPage });
const admAudit = createRoute({ getParentRoute: () => adminRoute, path: "/audit", component: AdmAuditPage });
const admSettings = createRoute({ getParentRoute: () => adminRoute, path: "/settings", component: AdmSettingsPage });
const admStaff = createRoute({ getParentRoute: () => adminRoute, path: "/staff", component: AdmStaffPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketplaceRoute,
  publisherProfileRoute,
  loginRoute,
  registerRoute,
  advRoute.addChildren([
    advIndex,
    advBrowse,
    advAssistant,
    advCampaigns,
    advCampaignDetail,
    advBookings,
    advBookingDetail,
    advCreativeStudio,
    advCreativeJob,
    advMessages,
    advFiles,
    advPayments,
    advInvoices,
    advShortlist,
    advSettings,
  ]),
  pubRoute.addChildren([
    pubIndex,
    pubPackages,
    pubBookings,
    pubBookingDetail,
    pubEarnings,
    pubProfile,
    pubMessages,
  ]),
  adminRoute.addChildren([
    admIndex,
    admPublishers,
    admAdvertisers,
    admBookings,
    admBookingDetail,
    admPayments,
    admSettlements,
    admCreativeStudio,
    admDisputes,
    admReports,
    admAudit,
    admSettings,
    admStaff,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

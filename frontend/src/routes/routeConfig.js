import { lazy } from 'react';
import { RoleType } from '../constants/enums';

// single source of truth for both the router and the side nav — a route's
// `roles` list gates whether it's ever mounted at all (not just linked to),
// and `navText` (when present) makes it appear in the nav. This is what
// "enforced at the page/nav level, not just route guards" means in
// practice: a Customer session's route tree literally never contains the
// Admin components, see implementation spec §8.
export const routes = [
  // available to both roles; no navText, so it never appears in the side
  // nav — only reachable via the profile menu in the top nav
  {
    path: '/profile',
    roles: [RoleType.ADMIN, RoleType.CUSTOMER],
    Component: lazy(() => import('../pages/ProfilePage')),
  },
  {
    path: '/admin/dashboard',
    roles: [RoleType.ADMIN],
    navText: 'Dashboard',
    Component: lazy(() => import('../pages/admin/AdminDashboardPage')),
  },
  {
    path: '/admin/users',
    roles: [RoleType.ADMIN],
    navText: 'Users',
    Component: lazy(() => import('../pages/admin/UsersPage')),
  },
  {
    path: '/admin/accounts',
    roles: [RoleType.ADMIN],
    navText: 'Accounts',
    Component: lazy(() => import('../pages/admin/AccountsPage')),
  },
  {
    path: '/admin/accounts/:id',
    roles: [RoleType.ADMIN],
    Component: lazy(() => import('../pages/admin/AccountDetailPage')),
  },
  {
    path: '/admin/devices',
    roles: [RoleType.ADMIN],
    navText: 'Devices',
    Component: lazy(() => import('../pages/admin/DevicesPage')),
  },
  {
    path: '/admin/devices/:id',
    roles: [RoleType.ADMIN],
    Component: lazy(() => import('../pages/admin/DeviceDetailPage')),
  },
  {
    path: '/admin/pricing',
    roles: [RoleType.ADMIN],
    navText: 'Pricing',
    Component: lazy(() => import('../pages/admin/PricingPage')),
  },
  {
    path: '/admin/invoices',
    roles: [RoleType.ADMIN],
    navText: 'Invoices',
    Component: lazy(() => import('../pages/admin/InvoicesPage')),
  },
  {
    path: '/admin/invoices/:id',
    roles: [RoleType.ADMIN],
    Component: lazy(() => import('../pages/admin/InvoiceDetailPage')),
  },
  {
    path: '/account',
    roles: [RoleType.CUSTOMER],
    navText: 'My account',
    Component: lazy(() => import('../pages/customer/AccountPage')),
  },
  {
    path: '/account/devices/:id',
    roles: [RoleType.CUSTOMER],
    Component: lazy(() => import('../pages/customer/CustomerDeviceDetailPage')),
  },
  {
    path: '/invoices',
    roles: [RoleType.CUSTOMER],
    navText: 'My invoices',
    Component: lazy(() => import('../pages/customer/CustomerInvoicesPage')),
  },
  {
    path: '/invoices/:id',
    roles: [RoleType.CUSTOMER],
    Component: lazy(() => import('../pages/customer/CustomerInvoiceDetailPage')),
  },
];

// where "/" redirects to, per role — first nav-worthy page for that role
export const homePathByRole = {
  [RoleType.ADMIN]: '/admin/dashboard',
  [RoleType.CUSTOMER]: '/account',
};

export function routesForRole(roleType) {
  return routes.filter((route) => route.roles.includes(roleType));
}

export function navItemsForRole(roleType) {
  return routesForRole(roleType)
    .filter((route) => route.navText)
    .map((route) => ({ type: 'link', text: route.navText, href: route.path }));
}

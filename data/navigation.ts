import {
  CreditCard,
  LayoutDashboard,
  Settings,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
}

/** Secondary navigation of the dashboard sidebar. */
export const dashboardNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "My videos", href: "/videos", Icon: Video },
  { label: "Billing", href: "/billing", Icon: CreditCard },
  { label: "Settings", href: "/settings", Icon: Settings },
];

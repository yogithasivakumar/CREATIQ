export interface NavItem {
  label: string;
  href: string;
  description: string;
  icon: string;
  implemented: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "Overview of your workspace.",
    icon: "home",
    implemented: true,
  },
  {
    label: "Generate Image",
    href: "/dashboard/generate",
    description: "Turn a text prompt into an image.",
    icon: "sparkles",
    implemented: true,
  },
  {
    label: "Asset Library",
    href: "/dashboard/assets",
    description: "Browse and manage generated assets.",
    icon: "folder",
    implemented: true,
  },
  {
    label: "Projects",
    href: "/dashboard/projects",
    description: "Organize assets into projects.",
    icon: "grid",
    implemented: true,
  },
  {
    label: "Creative Editor",
    href: "/dashboard/creative-editor",
    description: "Edit and compose designs.",
    icon: "edit",
    implemented: false,
  },
  {
    label: "Instagram Publishing",
    href: "/dashboard/instagram",
    description: "Generate captions and publish directly to Instagram.",
    icon: "instagram",
    implemented: true,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    description: "Manage your account and preferences.",
    icon: "settings",
    implemented: true,
  },
];

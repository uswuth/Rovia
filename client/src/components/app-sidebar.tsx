import * as React from "react"
import { Link } from "react-router-dom"
import { LayoutDashboard, FolderGit2, Video, CheckSquare, Building2, Users } from "lucide-react"

import { useAuth } from "@/context/AuthContext"
import { maskEmail } from "@/utils/privacy"
import { IntellMeetLogo } from "@/components/ui/IntellMeetLogo"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useSidebar } from "@/components/ui/sidebar-context"

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth()
  const { state } = useSidebar()
  const isSuperAdmin = user?.userRole === 'SuperAdmin' || user?.isSuperAdmin
  const isAdmin = isSuperAdmin || user?.userRole === 'Admin'

  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboard size={18} />,
      isActive: true,
    },
    ...(isAdmin
      ? [
        {
          title: "Organization",
          url: "/organization/members",
          icon: <Building2 size={18} />,
          items: [
            {
              title: "Org Members",
              url: "/organization/members",
            },
            {
              title: "Org Work Roles",
              url: "/organization/work-roles",
            },
          ],
        },
      ]
      : []),
    {
      title: "Projects",
      url: "/projects",
      icon: <FolderGit2 size={18} />,
      items: [
        {
          title: "All Projects",
          url: "/projects",
        },
        {
          title: "Active",
          url: "/projects?status=active",
        },
        {
          title: "Completed",
          url: "/projects?status=completed",
        },
        {
          title: "Archived",
          url: "/projects?status=archived",
        },
      ],
    },
    {
      title: "Teams",
      url: "/teams",
      icon: <Users size={18} />,
    },
    {
      title: "Meetings",
      url: "/meetings?tab=upcoming",
      icon: <Video size={18} />,
      items: [
        {
          title: "Upcoming Sessions",
          url: "/meetings?tab=upcoming",
        },
        {
          title: "Meeting History",
          url: "/meetings?tab=past",
        },
        {
          title: "All Sessions",
          url: "/meetings?tab=all",
        },
      ],
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: <CheckSquare size={18} />,
    },
  ]



  const userData = {
    name: user?.userName || "IntellMeet User",
    email: user?.userEmail ? maskEmail(user.userEmail) : "user@intellmeet.com",
    avatar: user?.avatarUrl || "",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-14 flex-row items-center justify-start group-data-[collapsible=icon]:justify-center border-b border-sidebar-border px-3.5 group-data-[collapsible=icon]:px-0 py-0">
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 min-w-0 transition-opacity hover:opacity-90 group"
        >
          <div className="flex h-8 w-8 items-center justify-center shrink-0 transition-colors">
            <IntellMeetLogo size={22} />
          </div>
          {state === "expanded" && (
            <span className="font-bold text-[15px] tracking-tight text-foreground truncate leading-none flex items-center">
              Intell<span className="text-emerald-600 dark:text-emerald-400 font-extrabold ml-0.5">Meet</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <NavUser
          user={userData}
          onLogout={logout}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

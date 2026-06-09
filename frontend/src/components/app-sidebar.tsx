import {
  BoxesIcon,
  BrainIcon,
  CalendarCogIcon,
  ClipboardListIcon,
  ClipboardPenLineIcon,
  LayoutDashboardIcon,
  PlayCircleIcon,
  WaypointsIcon,
} from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar"

export type AppView =
  | "dashboard"
  | "assessment"
  | "event"
  | "methods"
  | "competencies"
  | "variables"
  | "rosters"
  | "assessment-runs"

type AppSidebarProps = {
  activeView?: AppView
  competencyCount?: number
  eventCount?: number
  methodCount?: number
  rosterCount?: number
  runCount?: number
  variableCount?: number
  onViewChange?: (view: AppView) => void
}

const workspaceNavItems = [
  {
    view: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    view: "assessment",
    label: "Assessment editor",
    icon: ClipboardPenLineIcon,
  },
  {
    view: "event",
    label: "Event editor",
    icon: CalendarCogIcon,
  },
  {
    view: "methods",
    label: "Methods",
    icon: WaypointsIcon,
  },
  {
    view: "competencies",
    label: "Competencies",
    icon: BrainIcon,
  },
  {
    view: "variables",
    label: "Variables",
    icon: BoxesIcon,
  },
] satisfies Array<{
  view: AppView
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}>

const administerNavItems = [
  {
    view: "rosters",
    label: "Rosters",
    icon: ClipboardListIcon,
  },
  {
    view: "assessment-runs",
    label: "Assessment runs",
    icon: PlayCircleIcon,
  },
] satisfies Array<{
  view: AppView
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}>

export function AppSidebar({
  activeView = "dashboard",
  competencyCount = 0,
  eventCount = 0,
  methodCount = 0,
  rosterCount = 0,
  runCount = 0,
  variableCount = 0,
  onViewChange = () => undefined,
}: AppSidebarProps) {
  function menuBadge(view: AppView) {
    if (view === "dashboard" && eventCount > 0) return eventCount
    if (view === "methods" && methodCount > 0) return methodCount
    if (view === "competencies" && competencyCount > 0) return competencyCount
    if (view === "variables" && variableCount > 0) return variableCount
    if (view === "rosters" && rosterCount > 0) return rosterCount
    if (view === "assessment-runs" && runCount > 0) return runCount
    return null
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex flex-col gap-1 px-2 py-1">
          <div className="font-heading text-sm font-medium">
            Assessment Builder
          </div>
          <div className="text-xs text-sidebar-foreground/70">
            Events, methods, variables
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNavItems.map((item) => {
                const badge = menuBadge(item.view)
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={activeView === item.view}
                      onClick={() => onViewChange(item.view)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {administerNavItems.map((item) => {
                const badge = menuBadge(item.view)
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={activeView === item.view}
                      onClick={() => onViewChange(item.view)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/70">
          Draft session
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

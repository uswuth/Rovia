import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { CommonTabs, type TabItem } from '@/components/ui/common-tabs';

export interface MeetingFiltersBarProps {
  currentTab: string;
  onTabChange: (tabId: string) => void;
  statusTabs: TabItem[];
  searchInput: string;
  onSearchChange: (val: string) => void;
  onClearSearch: () => void;
  timeFilter: string;
  onTimeFilterChange: (val: string) => void;
  timeFilterOptions: SearchableSelectOption[];
  filterCreatedById: string;
  onCreatedByChange: (val: string) => void;
  createdByFilterOptions: SearchableSelectOption[];
  filterProjectId: string;
  onProjectChange: (val: string) => void;
  projectFilterOptions: SearchableSelectOption[];
  filterTeamId: string;
  onTeamChange: (val: string) => void;
  teamFilterOptions: SearchableSelectOption[];
  hasProjects: boolean;
  hasTeams: boolean;
}

export const MeetingFiltersBar: React.FC<MeetingFiltersBarProps> = ({
  currentTab,
  onTabChange,
  statusTabs,
  searchInput,
  onSearchChange,
  onClearSearch,
  timeFilter,
  onTimeFilterChange,
  timeFilterOptions,
  filterCreatedById,
  onCreatedByChange,
  createdByFilterOptions,
  filterProjectId,
  onProjectChange,
  projectFilterOptions,
  filterTeamId,
  onTeamChange,
  teamFilterOptions,
  hasProjects,
  hasTeams,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <CommonTabs
          items={statusTabs}
          value={currentTab}
          onChange={onTabChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:w-60 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search meetings..."
            className="pl-8 pr-8 h-8 text-xs bg-card"
          />
          {searchInput && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {currentTab === 'upcoming' && (
          <div className="w-36 shrink-0">
            <SearchableSelect
              value={timeFilter}
              onChange={onTimeFilterChange}
              options={timeFilterOptions}
              placeholder="Filter by time"
              searchPlaceholder="Search time..."
              className="w-full text-xs"
              align="right"
            />
          </div>
        )}

        {createdByFilterOptions.length > 1 && (
          <div className="w-40 shrink-0">
            <SearchableSelect
              value={filterCreatedById}
              onChange={onCreatedByChange}
              options={createdByFilterOptions}
              placeholder="All Creators"
              searchPlaceholder="Search creator..."
              className="w-full text-xs"
              align="right"
            />
          </div>
        )}

        {hasProjects && (
          <div className="w-44 shrink-0">
            <SearchableSelect
              value={filterProjectId}
              onChange={onProjectChange}
              options={projectFilterOptions}
              placeholder="All Projects"
              searchPlaceholder="Search projects..."
              className="w-full text-xs"
            />
          </div>
        )}

        {hasTeams && (
          <div className="w-40 shrink-0">
            <SearchableSelect
              value={filterTeamId}
              onChange={onTeamChange}
              options={teamFilterOptions}
              placeholder="All Teams"
              searchPlaceholder="Search teams..."
              className="w-full text-xs"
              align="right"
            />
          </div>
        )}
      </div>
    </div>
  );
};

'use client';

export const Shimmer = () => (
  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" />
);

export const SkeletonBase = ({ className = '', children }) => (
  <div className={`relative overflow-hidden bg-[var(--bg-hover)] border border-[var(--border-subtle)] ${className}`}>
    <Shimmer />
    {children}
  </div>
);

export const StatsCardSkeleton = () => (
  <SkeletonBase className="p-6 h-[140px] flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div className="w-8 h-8 rounded-full bg-white/5" />
      <div className="w-16 h-4 bg-white/5 rounded" />
    </div>
    <div>
      <div className="w-24 h-8 bg-white/5 rounded mb-2" />
      <div className="w-32 h-3 bg-white/5 rounded" />
    </div>
  </SkeletonBase>
);

export const JobCardSkeleton = () => (
  <SkeletonBase className="p-6 h-[200px] flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/5 rounded-none" />
        <div className="flex flex-col gap-2">
          <div className="w-32 h-5 bg-white/5 rounded" />
          <div className="w-24 h-3 bg-white/5 rounded" />
        </div>
      </div>
      <div className="w-8 h-8 bg-white/5 rounded-none" />
    </div>
    <div className="flex gap-2">
      <div className="w-16 h-5 bg-white/5 rounded" />
      <div className="w-16 h-5 bg-white/5 rounded" />
    </div>
    <div className="w-full h-8 bg-white/5 rounded-none" />
  </SkeletonBase>
);

export const ListRowSkeleton = () => (
  <SkeletonBase className="p-4 flex items-center justify-between">
    <div className="flex items-center gap-4 w-1/2">
      <div className="w-8 h-8 bg-white/5 rounded-none shrink-0" />
      <div className="flex flex-col gap-2 w-full">
        <div className="w-1/2 h-4 bg-white/5 rounded" />
        <div className="w-1/3 h-3 bg-white/5 rounded" />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="w-24 h-6 bg-white/5 rounded" />
      <div className="w-16 h-4 bg-white/5 rounded" />
    </div>
  </SkeletonBase>
);

export const KanbanCardSkeleton = () => (
  <SkeletonBase className="p-4 mb-3 h-[120px] flex flex-col justify-between">
    <div className="flex flex-col gap-2">
      <div className="w-3/4 h-4 bg-white/5 rounded" />
      <div className="w-1/2 h-3 bg-white/5 rounded" />
    </div>
    <div className="flex justify-between items-end mt-4">
      <div className="w-16 h-5 bg-white/5 rounded" />
      <div className="w-6 h-6 bg-white/5 rounded-none" />
    </div>
  </SkeletonBase>
);

export const CalendarGridSkeleton = () => (
  <div className="grid grid-cols-7 gap-[1px] bg-[var(--border-subtle)] border border-[var(--border-subtle)]">
    {Array.from({ length: 35 }).map((_, i) => (
      <SkeletonBase key={i} className="h-32 p-2 !bg-[var(--bg-surface)]">
        <div className="w-6 h-6 bg-white/5 rounded-full mb-2" />
        <div className="w-full h-4 bg-white/5 rounded mb-1" />
        <div className="w-3/4 h-4 bg-white/5 rounded" />
      </SkeletonBase>
    ))}
  </div>
);

export const DashboardPipelineSkeleton = () => (
  <SkeletonBase className="p-8 min-h-[300px]">
    <div className="w-48 h-6 bg-white/5 rounded mb-8" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="w-full h-24 bg-white/5 rounded" />
          <div className="w-2/3 h-4 bg-white/5 rounded mx-auto" />
        </div>
      ))}
    </div>
  </SkeletonBase>
);

export const ProfileSkeleton = () => (
  <div className="w-full space-y-6 pb-20">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <SkeletonBase className="p-8 h-[300px]" />
        <SkeletonBase className="p-6 h-[200px]" />
        <SkeletonBase className="p-6 h-[150px]" />
      </div>
      <div className="lg:col-span-9 space-y-6">
        <SkeletonBase className="p-8 h-[300px]" />
        <SkeletonBase className="p-8 h-[250px]" />
        <SkeletonBase className="p-8 h-[200px]" />
      </div>
    </div>
  </div>
);

export const SettingsSkeleton = () => (
  <div className="max-w-4xl space-y-8 pb-12">
    <SkeletonBase className="h-24 w-full" />
    <SkeletonBase className="h-64 w-full" />
    <SkeletonBase className="h-64 w-full" />
    <SkeletonBase className="h-48 w-full" />
  </div>
);

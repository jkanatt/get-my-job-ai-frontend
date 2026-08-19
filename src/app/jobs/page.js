'use client';

import { useState } from 'react';
import { useJobs } from '@/shared/hooks';
import JobCard from '@/features/jobs/components/JobCard';
import JobDetailsModal from '@/features/jobs/components/JobDetailsModal';
import { Search, RefreshCw, Briefcase } from 'lucide-react';
import { Button } from '@/shared/design-system/ui/Button';

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const { jobs, total, isLoading, mutate, addJob } = useJobs(page, 50, {});
  const [selectedJob, setSelectedJob] = useState(null);

  const filteredJobs = jobs.filter(job => 
    !searchQuery || 
    job.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    job.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[var(--bg-background)] relative">
      {/* Header */}
      <div className="flex-none p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
              <Briefcase size={18} className="text-[var(--c-primary)]" />
              Jobs Pipeline
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-mono uppercase tracking-wider">
              {isLoading ? 'Scanning opportunities...' : `Tracking ${total || jobs.length} matched positions`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => mutate()} className="h-8 w-8 p-0" title="Refresh">
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
            <input
              type="text"
              placeholder="Search by role or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-none text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-background)]">
        {isLoading && jobs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] space-y-4">
            <RefreshCw size={24} className="animate-spin text-[var(--c-primary)]" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Compiling opportunities...</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
            <Briefcase size={32} className="mb-4 opacity-20" />
            <span className="text-[10px] uppercase font-bold tracking-widest">No jobs found matching criteria</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-px bg-[var(--border-subtle)] border border-[var(--border-subtle)]">
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onDetails={() => setSelectedJob(job)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}

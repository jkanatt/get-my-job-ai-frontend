// Huge realistic mock data payload

export const MOCK_JOBS = {
  jobs: Array.from({ length: 45 }).map((_, i) => ({
    id: `job-${i}`,
    title: ['Senior Product Manager', 'Frontend Engineer', 'Full Stack Developer', 'Data Scientist', 'UX Designer'][i % 5],
    company: ['Google', 'Meta', 'Amazon', 'Netflix', 'Stripe', 'Vercel', 'OpenAI'][i % 7],
    location: ['San Francisco, CA', 'New York, NY', 'Remote', 'London, UK'][i % 4],
    salary: ['$150k - $200k', '$180k - $250k', '$120k - $160k', 'Competitive'][i % 4],
    description: 'We are looking for a highly skilled individual to join our fast-paced team...',
    match_score: Math.floor(Math.random() * 40) + 60,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    is_saved: i % 3 === 0
  })),
  total: 45,
  hasMore: false
};

export const MOCK_APPLICATIONS = {
  applications: Array.from({ length: 24 }).map((_, i) => ({
    id: `app-${i}`,
    job_id: `job-${i}`,
    job_title: ['Senior Product Manager', 'Frontend Engineer', 'Full Stack Developer', 'Data Scientist', 'UX Designer'][i % 5],
    company: ['Google', 'Meta', 'Amazon', 'Netflix', 'Stripe', 'Vercel', 'OpenAI'][i % 7],
    status: ['saved', 'applied', 'interviewing', 'offer', 'rejected'][i % 5],
    applied_date: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
    resume_version: `joshua_resume_v${i % 4 + 1}.pdf`,
    notes: 'Great culture, need to prepare for system design round.',
    last_activity: new Date(Date.now() - i * 3600000).toISOString(),
  })),
  total: 24,
  hasMore: false,
  limit: 50,
  offset: 0
};

export const MOCK_TRACKING_EVENTS = {
  events: [
    { id: 'ev-1', application_id: 'app-0', type: 'applied', description: 'Submitted application via Greenhouse', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 'ev-2', application_id: 'app-0', type: 'email_received', description: 'Recruiter reached out for initial screen', created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'ev-3', application_id: 'app-0', type: 'interview_scheduled', description: 'Technical Screen with Hiring Manager', created_at: new Date(Date.now() - 1 * 86400000).toISOString() }
  ]
};

export const MOCK_EMAILS = {
  emails: Array.from({ length: 30 }).map((_, i) => ({
    id: `email-${i}`,
    threadId: `thread-${i}`,
    from_name: ['Sarah Connor (Recruiter)', 'John Smith', 'Talent Acquisition', 'Google Careers'][i % 4],
    from_address: `recruiter${i}@example.com`,
    subject: ['Interview Request: Frontend Engineer', 'Update on your application', 'Next steps for Product role', 'Thanks for applying'][i % 4],
    snippet: 'Hi there, we reviewed your resume and would love to schedule a quick call...',
    body: '<p>Hi there, we reviewed your resume and would love to schedule a quick call...</p>',
    date: new Date(Date.now() - i * 3600000).toISOString(),
    is_read: i % 4 !== 0,
    label_ids: ['INBOX']
  })),
  total: 30,
  hasMore: false
};

export const MOCK_EMAIL_COUNTS = {
  inbox: 12, sent: 45, draft: 3, scheduled: 0, trash: 156, starred: 8
};

export const MOCK_CALENDAR = {
  events: [
    { id: 'cal-1', title: 'Google - Technical Screen', start: new Date(Date.now() + 86400000).toISOString(), end: new Date(Date.now() + 90000000).toISOString(), type: 'interview' },
    { id: 'cal-2', title: 'Meta - Recruiter Call', start: new Date(Date.now() + 172800000).toISOString(), end: new Date(Date.now() + 176400000).toISOString(), type: 'screen' }
  ]
};

export const MOCK_PROFILE = {
  name: 'Joshua Kanatt',
  email: 'joshua@example.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  title: 'Senior Product Manager & Engineer',
  experience: [{ title: 'Product Manager', company: 'Ideate Technologies', start: '2020', end: 'Present' }],
  skills: ['React', 'Next.js', 'Product Strategy', 'Node.js'],
  education: [{ degree: 'B.S. Computer Science', school: 'University of Technology', year: '2019' }],
  projects: [{ name: 'Get My Job AI', description: 'Automated ATS platform' }],
  portfolio_links: ['https://github.com/jkanatt', 'https://linkedin.com/in/jkanatt']
};

export const MOCK_SETTINGS = {
  gmail_user: 'demo@getmyjob.ai',
  sender_name: 'Joshua Kanatt',
  resume_prefix: 'Resume_Joshua_Kanatt',
  build_path: '/generated/resumes',
  linkedin_keywords: 'Product Manager, Software Engineer',
  max_posts_per_scan: 200,
  auto_scan_interval: 'daily',
  min_ats_threshold: 75,
  headless_mode: true,
  auto_date_naming: true,
  auto_apply: false,
  sync_enabled: true,
  email_signature: 'Best,\nJoshua Kanatt',
  is_onboarded: true
};

export const MOCK_DASHBOARD_STATS = {
  metrics: {
    total_applications: 145,
    interviews: 12,
    offers: 2,
    rejections: 34,
    response_rate: 15.5
  },
  sparklineData: [
    { date: 'Mon', applications: 4 },
    { date: 'Tue', applications: 7 },
    { date: 'Wed', applications: 2 },
    { date: 'Thu', applications: 9 },
    { date: 'Fri', applications: 12 },
    { date: 'Sat', applications: 1 },
    { date: 'Sun', applications: 3 }
  ],
  funnelData: [
    { name: 'Applied', value: 145 },
    { name: 'Screening', value: 45 },
    { name: 'Interview', value: 12 },
    { name: 'Offer', value: 2 }
  ],
  nextInterview: {
    company: 'Google',
    role: 'Frontend Engineer',
    time: new Date(Date.now() + 86400000).toISOString()
  },
  activityFeed: [
    { id: 'act-1', type: 'status_change', text: 'Google changed status to Interviewing', time: '2 hours ago' },
    { id: 'act-2', type: 'email', text: 'Received email from Meta Recruiter', time: '5 hours ago' },
    { id: 'act-3', type: 'application', text: 'Applied to Vercel (Senior React Engineer)', time: '1 day ago' }
  ],
  needsAttention: [
    { id: 'att-1', type: 'follow_up', company: 'Stripe', role: 'Product Manager', days: 7 }
  ],
  isEmpty: false
};

export const MOCK_CONTACTS = {
  contacts: Array.from({ length: 15 }).map((_, i) => ({
    id: `contact-${i}`,
    name: ['Sarah Connor', 'John Smith', 'Michael Chen', 'Emily Davis'][i % 4],
    email: `recruiter${i}@example.com`,
    company: ['Google', 'Meta', 'Amazon', 'Netflix', 'Stripe'][i % 5],
    role: 'Technical Recruiter',
    last_contact: new Date(Date.now() - i * 86400000).toISOString(),
    notes: 'Connected via LinkedIn'
  })),
  total: 15,
  hasMore: false
};

export const MOCK_EMAIL_TEMPLATES = [
  { id: 'tpl-1', name: 'Initial Follow Up', subject: 'Following up on my application for {role}', body: 'Hi {name},\n\nI applied for the {role} position last week and wanted to reiterate my interest...' },
  { id: 'tpl-2', name: 'Post Interview Thank You', subject: 'Thank you - {role} Interview', body: 'Hi {name},\n\nThank you for taking the time to speak with me today...' }
];

/**
 * nlpScorer.js — v2
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * World-class local NLP scoring engine — zero API cost, runs in <100ms
 * 
 * v2 Upgrades:
 *   - Semantic keyword tiering (must_have / preferred / implied)
 *   - 60+ synonym clusters for PM / Fintech / SaaS domains
 *   - Weighted keyword coverage scoring
 *   - Business impact (XYZ formula) detection
 *   - Seniority-level language alignment
 *   - Enhanced project ranking with tag matching
 */

import natural from 'natural';
import nlp from 'compromise';

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const stemmer = natural.PorterStemmer;
const NGrams = natural.NGrams;

// ─── Ontology Graph (L2: Semantic Correlation) ───────────────────────────
// Define parent-child and lateral relationships to compute semantic distance
const ONTOLOGY_GRAPH = {
  'Product Management': ['Agile & Methodologies', 'Analytics & Data Science', 'Growth & Marketing', 'Project Management Tools', 'Leadership & Management'],
  'Software Engineering': ['DevOps & Cloud', 'Cybersecurity', 'Database', 'System Design'],
  'Data Science': ['Analytics & Data Science', 'AI / ML / Data', 'Database', 'Python', 'Machine Learning'],
  'Growth & Marketing': ['Sales & Revenue', 'E-commerce & Marketplace', 'Analytics & Data Science'],
  'Fintech & Payments': ['Cybersecurity', 'Legal & Compliance', 'Data Science'],
  'Design & UX': ['Frontend', 'Product Management', 'Interaction Design'],
  'Sales & Revenue': ['Growth & Marketing', 'CRM', 'Account Management']
};

/**
 * Extracts N-Grams (Unigrams + Bigrams + Trigrams) and returns them as a single string 
 * where compounds are joined by underscores (e.g. "machine_learning").
 */
export function extractStructuralTokens(text) {
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const bigrams = NGrams.bigrams(tokens).map(b => b.join('_'));
  const trigrams = NGrams.trigrams(tokens).map(t => t.join('_'));
  return [...tokens, ...bigrams, ...trigrams].join(' ');
}

// ─── Synonym Clusters ─────────────────────────────────────────────────────
// Each cluster maps related terms so that matching ANY term in a cluster
// counts as matching ALL terms in that cluster.
export const SYNONYM_CLUSTERS = [
  // ─── Product Management ──────────────────────────────────────────────
  ['prd', 'product requirements document', 'product requirements', 'product spec', 'product specification', 'brd', 'business requirements document'],
  ['gtm', 'go-to-market', 'go to market', 'go-to-market strategy', 'launch strategy', 'market entry'],
  ['roadmap', 'product roadmap', 'strategic roadmap', 'feature roadmap', 'technology roadmap'],
  ['backlog', 'product backlog', 'backlog management', 'backlog prioritization', 'backlog grooming', 'backlog refinement'],
  ['user stories', 'user story', 'acceptance criteria', 'story writing', 'epic', 'feature specification'],
  ['okr', 'okrs', 'objectives and key results', 'key results'],
  ['kpi', 'kpis', 'key performance indicator', 'key performance indicators', 'metrics', 'key metrics', 'performance metrics'],
  ['stakeholder management', 'stakeholder alignment', 'cross-functional collaboration', 'cross-functional leadership', 'stakeholder engagement'],
  ['product discovery', 'customer discovery', 'user research', 'user interviews', 'customer interviews'],
  ['product strategy', 'product vision', 'strategic thinking', 'product thinking', 'product sense'],
  ['pmf', 'product-market fit', 'product market fit'],
  ['sprint', 'sprint planning', 'sprint review', 'sprint retrospective', 'iteration'],
  ['release management', 'release planning', 'feature release', 'deployment planning'],
  ['mvp', 'minimum viable product', 'proof of concept', 'poc', 'prototype'],

  // ─── Agile & Methodologies ──────────────────────────────────────────
  ['agile', 'agile methodology', 'agile development', 'agile framework', 'agile practices'],
  ['scrum', 'scrum master', 'scrum framework', 'scrum ceremonies'],
  ['kanban', 'kanban board', 'lean kanban', 'lean methodology'],
  ['rice', 'rice scoring', 'rice prioritization', 'rice framework'],
  ['moscow', 'moscow prioritization', 'moscow method'],
  ['safe', 'scaled agile framework', 'scaled agile'],
  ['six sigma', 'lean six sigma', 'dmaic', 'process improvement'],
  ['waterfall', 'waterfall methodology', 'traditional project management'],
  ['design thinking', 'human-centered design', 'hcd', 'empathy mapping'],

  // ─── Growth & Marketing ─────────────────────────────────────────────
  ['plg', 'product-led growth', 'product led growth'],
  ['slg', 'sales-led growth', 'sales led growth'],
  ['cac', 'customer acquisition cost', 'acquisition cost'],
  ['ltv', 'lifetime value', 'customer lifetime value', 'clv'],
  ['retention', 'user retention', 'customer retention', 'retention rate', 'churn reduction', 'churn rate'],
  ['conversion', 'conversion rate', 'conversion funnel', 'funnel optimization', 'conversion optimization', 'cro'],
  ['a/b testing', 'ab testing', 'experimentation', 'split testing', 'multivariate testing'],
  ['seo', 'search engine optimization', 'organic search', 'organic traffic'],
  ['sem', 'search engine marketing', 'paid search', 'ppc', 'pay per click', 'google ads'],
  ['nps', 'net promoter score', 'customer satisfaction', 'csat'],
  ['content marketing', 'content strategy', 'content creation', 'editorial calendar'],
  ['email marketing', 'marketing automation', 'crm marketing', 'drip campaigns'],
  ['social media marketing', 'smm', 'social media strategy', 'social media management'],
  ['brand management', 'brand strategy', 'brand identity', 'brand positioning'],
  ['growth hacking', 'growth strategy', 'viral growth', 'referral programs'],
  ['performance marketing', 'paid media', 'media buying', 'programmatic advertising'],
  ['influencer marketing', 'creator economy', 'partnership marketing'],
  ['demand generation', 'demand gen', 'lead generation', 'lead gen', 'pipeline generation'],
  ['market research', 'competitive analysis', 'market analysis', 'market intelligence'],
  ['pricing strategy', 'monetization', 'revenue model', 'pricing optimization'],

  // ─── Analytics & Data Science ───────────────────────────────────────
  ['sql', 'structured query language', 'mysql', 'postgresql', 'postgres'],
  ['data analytics', 'data analysis', 'data-driven', 'data driven', 'analytics', 'business analytics'],
  ['tableau', 'power bi', 'data visualization', 'dashboard', 'looker', 'metabase', 'data studio'],
  ['google analytics', 'ga4', 'ga analytics'],
  ['mixpanel', 'amplitude', 'product analytics', 'heap analytics'],
  ['cohort analysis', 'retention cohorts', 'cohort', 'funnel analysis'],
  ['python', 'python programming', 'python3', 'py'],
  ['r programming', 'r language', 'r studio', 'rstudio'],
  ['pandas', 'numpy', 'scipy', 'data manipulation'],
  ['machine learning', 'ml', 'predictive modeling', 'statistical modeling'],
  ['deep learning', 'neural networks', 'neural network', 'tensorflow', 'pytorch', 'keras'],
  ['data engineering', 'data pipeline', 'etl', 'elt', 'data warehousing', 'data warehouse'],
  ['big data', 'hadoop', 'spark', 'apache spark', 'data lake', 'data lakehouse'],
  ['statistics', 'statistical analysis', 'hypothesis testing', 'regression analysis', 'probability'],
  ['feature engineering', 'feature selection', 'model training', 'model evaluation'],
  ['data modeling', 'data architecture', 'data governance', 'data quality', 'data catalog'],
  ['business intelligence', 'bi', 'bi tools', 'reporting', 'executive reporting'],
  ['snowflake', 'redshift', 'bigquery', 'databricks', 'dbt'],

  // ─── Fintech & Payments ─────────────────────────────────────────────
  ['upi', 'unified payments interface', 'upi payments'],
  ['kyc', 'know your customer', 'kyc/aml', 'identity verification', 'ekyc', 'customer verification'],
  ['aml', 'anti-money laundering', 'compliance', 'regulatory compliance'],
  ['bfsi', 'banking financial services insurance', 'banking', 'financial services'],
  ['lending', 'digital lending', 'loan', 'credit', 'los', 'loan origination', 'underwriting'],
  ['payment gateway', 'payment processing', 'payment infrastructure', 'payment rails'],
  ['fintech', 'financial technology'],
  ['rbi', 'reserve bank of india', 'regulatory compliance', 'banking regulation'],
  ['blockchain', 'distributed ledger', 'web3', 'smart contracts', 'defi', 'decentralized finance'],
  ['cryptocurrency', 'crypto', 'digital currency', 'digital assets', 'token'],
  ['insurtech', 'insurance technology', 'digital insurance'],
  ['wealth management', 'investment management', 'portfolio management', 'asset management'],
  ['risk management', 'risk assessment', 'credit risk', 'operational risk', 'fraud detection'],

  // ─── Software Engineering ───────────────────────────────────────────
  ['javascript', 'js', 'ecmascript', 'es6', 'es2015'],
  ['typescript', 'ts', 'typed javascript'],
  ['react', 'reactjs', 'react.js', 'react hooks', 'react native'],
  ['angular', 'angularjs', 'angular.js'],
  ['vue', 'vuejs', 'vue.js', 'vue 3'],
  ['node', 'nodejs', 'node.js', 'express', 'expressjs'],
  ['java', 'java programming', 'jvm', 'spring', 'spring boot', 'springboot'],
  ['c#', 'csharp', 'c sharp', '.net', 'dotnet', 'asp.net'],
  ['golang', 'go language', 'go programming'],
  ['rust', 'rust programming', 'rust language'],
  ['swift', 'swift programming', 'ios development', 'swiftui'],
  ['kotlin', 'kotlin programming', 'android development'],
  ['frontend', 'front-end', 'front end', 'client side', 'client-side'],
  ['backend', 'back-end', 'back end', 'server side', 'server-side'],
  ['fullstack', 'full-stack', 'full stack'],
  ['testing', 'unit testing', 'integration testing', 'test automation', 'qa', 'quality assurance'],
  ['tdd', 'test driven development', 'test-driven development', 'bdd', 'behavior driven development'],
  ['code review', 'peer review', 'pull request', 'pr review'],
  ['system design', 'architecture design', 'software architecture', 'system architecture'],
  ['distributed systems', 'distributed computing', 'scalable systems', 'horizontal scaling'],
  ['database', 'rdbms', 'relational database', 'nosql', 'mongodb', 'cassandra', 'dynamodb'],
  ['caching', 'redis', 'memcached', 'cache optimization', 'cdn'],
  ['message queue', 'kafka', 'rabbitmq', 'sqs', 'event driven', 'event-driven architecture'],
  ['graphql', 'graph ql', 'apollo graphql'],
  ['websocket', 'websockets', 'real-time communication', 'socket.io'],
  ['mobile development', 'mobile app', 'ios', 'android', 'cross-platform', 'flutter'],

  // ─── DevOps & Cloud ─────────────────────────────────────────────────
  ['aws', 'amazon web services', 'amazon cloud'],
  ['gcp', 'google cloud', 'google cloud platform'],
  ['azure', 'microsoft azure', 'azure cloud'],
  ['docker', 'containerization', 'container', 'dockerfile'],
  ['kubernetes', 'k8s', 'container orchestration', 'helm'],
  ['terraform', 'infrastructure as code', 'iac', 'pulumi', 'cloudformation'],
  ['ci/cd', 'continuous integration', 'continuous deployment', 'continuous delivery', 'github actions', 'jenkins', 'gitlab ci'],
  ['monitoring', 'observability', 'logging', 'alerting', 'datadog', 'prometheus', 'grafana', 'new relic'],
  ['devops', 'dev ops', 'site reliability', 'sre', 'platform engineering'],
  ['serverless', 'lambda', 'cloud functions', 'faas', 'function as a service'],
  ['load balancing', 'auto scaling', 'autoscaling', 'high availability', 'ha', 'fault tolerance'],
  ['networking', 'vpc', 'dns', 'ssl', 'tls', 'https', 'firewall', 'load balancer'],
  ['linux', 'unix', 'bash', 'shell scripting', 'command line'],

  // ─── Cybersecurity ──────────────────────────────────────────────────
  ['cybersecurity', 'cyber security', 'information security', 'infosec'],
  ['penetration testing', 'pen testing', 'ethical hacking', 'vulnerability assessment'],
  ['siem', 'security information and event management', 'splunk', 'sentinel'],
  ['soc', 'security operations center', 'incident response', 'ir'],
  ['firewall', 'ids', 'ips', 'intrusion detection', 'intrusion prevention'],
  ['encryption', 'cryptography', 'data encryption', 'ssl/tls'],
  ['zero trust', 'zero trust architecture', 'identity management', 'iam'],
  ['gdpr', 'data privacy', 'privacy compliance', 'ccpa', 'hipaa compliance'],
  ['owasp', 'web application security', 'application security', 'appsec'],
  ['threat intelligence', 'threat hunting', 'threat modeling', 'mitre att&ck'],

  // ─── Design & UX ────────────────────────────────────────────────────
  ['figma', 'sketch', 'adobe xd', 'design tools', 'invision'],
  ['wireframe', 'wireframing', 'wireframes', 'mockup', 'prototype', 'prototyping'],
  ['ux', 'user experience', 'ux design', 'ux research', 'user centered design'],
  ['ui', 'user interface', 'ui design', 'interface design', 'visual design'],
  ['design system', 'design systems', 'component library', 'style guide'],
  ['usability testing', 'user testing', 'ux testing', 'a/b testing design'],
  ['interaction design', 'ixd', 'motion design', 'animation design'],
  ['accessibility', 'a11y', 'wcag', 'ada compliance', 'inclusive design'],
  ['information architecture', 'ia', 'content strategy', 'taxonomy'],

  // ─── Project Management Tools ───────────────────────────────────────
  ['jira', 'atlassian jira', 'jira software'],
  ['confluence', 'atlassian confluence'],
  ['notion', 'notion workspace'],
  ['miro', 'miroboard', 'whiteboarding'],
  ['firebase', 'google firebase'],
  ['asana', 'asana project management'],
  ['monday.com', 'monday', 'work management'],
  ['trello', 'trello board', 'kanban tool'],
  ['linear', 'linear app', 'linear project management'],
  ['clickup', 'click up', 'clickup workspace'],
  ['basecamp', 'basecamp project management'],
  ['smartsheet', 'smartsheet project management'],

  // ─── AI / ML / Data ────────────────────────────────────────────────
  ['ai', 'artificial intelligence', 'ai/ml', 'machine learning', 'ml'],
  ['llm', 'large language model', 'large language models', 'generative ai', 'gen ai', 'genai'],
  ['nlp', 'natural language processing', 'text analytics', 'text mining'],
  ['computer vision', 'image recognition', 'object detection', 'cv'],
  ['recommendation system', 'recommender system', 'collaborative filtering', 'personalization engine'],
  ['mlops', 'ml ops', 'model deployment', 'model serving', 'model monitoring'],
  ['rag', 'retrieval augmented generation', 'vector database', 'embeddings'],
  ['prompt engineering', 'prompt design', 'prompt optimization'],
  ['chatbot', 'conversational ai', 'dialogue system', 'virtual assistant'],
  ['reinforcement learning', 'rl', 'reward modeling'],

  // ─── Tech & Engineering Core ────────────────────────────────────────
  ['api', 'rest api', 'restful api', 'api integration', 'api design', 'api gateway'],
  ['saas', 'software as a service', 'saas platform', 'cloud software'],
  ['b2b', 'business to business', 'enterprise', 'enterprise software'],
  ['b2c', 'business to consumer', 'consumer', 'consumer app'],
  ['b2b2c', 'platform business model', 'marketplace'],
  ['sdk', 'software development kit', 'library', 'framework'],
  ['microservices', 'micro services', 'service oriented architecture', 'soa'],
  ['git', 'github', 'gitlab', 'bitbucket', 'version control'],
  ['open source', 'oss', 'foss', 'open-source contribution'],
  ['technical debt', 'tech debt', 'code quality', 'refactoring'],
  ['scalability', 'scaling', 'performance optimization', 'capacity planning'],
  ['low code', 'no code', 'low-code', 'no-code', 'citizen developer'],

  // ─── Healthcare & Life Sciences ─────────────────────────────────────
  ['ehr', 'electronic health records', 'emr', 'electronic medical records', 'health records'],
  ['hipaa', 'health insurance portability', 'healthcare compliance', 'phi'],
  ['telemedicine', 'telehealth', 'virtual care', 'remote patient monitoring'],
  ['clinical trials', 'clinical research', 'clinical data', 'fda', 'regulatory affairs'],
  ['healthcare it', 'health informatics', 'health tech', 'healthtech', 'medtech'],
  ['hl7', 'fhir', 'healthcare interoperability', 'health data exchange'],
  ['pharmaceutical', 'pharma', 'drug discovery', 'biotech', 'biotechnology'],
  ['patient engagement', 'patient experience', 'digital health', 'mhealth'],

  // ─── Supply Chain & Logistics ───────────────────────────────────────
  ['supply chain', 'supply chain management', 'scm', 'logistics'],
  ['procurement', 'sourcing', 'strategic sourcing', 'vendor management'],
  ['inventory management', 'warehouse management', 'wms', 'inventory control'],
  ['erp', 'enterprise resource planning', 'sap', 'oracle erp', 'netsuite'],
  ['last mile delivery', 'fulfillment', 'order fulfillment', 'distribution'],
  ['demand forecasting', 'demand planning', 'sales forecasting', 'inventory optimization'],

  // ─── HR & Talent ────────────────────────────────────────────────────
  ['hris', 'human resource information system', 'workday', 'successfactors'],
  ['ats', 'applicant tracking system', 'greenhouse', 'lever', 'workable'],
  ['employee engagement', 'employee experience', 'people analytics', 'workforce analytics'],
  ['compensation', 'total rewards', 'benefits administration', 'payroll'],
  ['performance management', 'performance review', 'talent management', 'succession planning'],
  ['l&d', 'learning and development', 'training', 'employee development', 'upskilling'],
  ['dei', 'diversity equity inclusion', 'diversity and inclusion', 'd&i'],
  ['employer branding', 'talent branding', 'recruitment marketing'],

  // ─── Sales & Revenue ────────────────────────────────────────────────
  ['crm', 'customer relationship management', 'salesforce', 'hubspot crm'],
  ['sales pipeline', 'pipeline management', 'deal flow', 'sales funnel'],
  ['account management', 'key account management', 'customer success', 'cs'],
  ['revenue operations', 'revops', 'revenue management', 'revenue optimization'],
  ['sdrs', 'sales development', 'business development', 'bdr', 'outbound sales'],
  ['enterprise sales', 'solution selling', 'consultative selling', 'complex sales'],
  ['quota', 'quota attainment', 'sales targets', 'revenue targets', 'bookings'],
  ['churn', 'customer churn', 'retention strategy', 'renewal management'],
  ['upsell', 'cross-sell', 'expansion revenue', 'land and expand'],

  // ─── Legal & Compliance ─────────────────────────────────────────────
  ['contract management', 'clm', 'contract lifecycle management'],
  ['compliance', 'regulatory compliance', 'audit', 'sox', 'sarbanes-oxley'],
  ['intellectual property', 'ip', 'patent', 'trademark', 'copyright'],
  ['data privacy', 'gdpr', 'ccpa', 'data protection', 'privacy policy'],
  ['legal operations', 'legal ops', 'legal tech', 'legaltech'],

  // ─── Consulting & Strategy ──────────────────────────────────────────
  ['management consulting', 'strategy consulting', 'business consulting'],
  ['due diligence', 'market sizing', 'tam sam som', 'total addressable market'],
  ['business case', 'roi analysis', 'cost benefit analysis', 'feasibility study'],
  ['change management', 'organizational change', 'transformation', 'digital transformation'],
  ['business process', 'bpm', 'process optimization', 'process reengineering'],

  // ─── Operations & Program Management ────────────────────────────────
  ['program management', 'program manager', 'portfolio management'],
  ['project management', 'project manager', 'pmp', 'prince2'],
  ['operations management', 'ops', 'operational excellence'],
  ['process automation', 'rpa', 'robotic process automation', 'workflow automation'],
  ['capacity planning', 'resource planning', 'resource allocation'],
  ['budgeting', 'budget management', 'financial planning', 'p&l management', 'profit and loss'],

  // ─── E-commerce & Marketplace ───────────────────────────────────────
  ['e-commerce', 'ecommerce', 'online retail', 'digital commerce'],
  ['marketplace', 'two-sided marketplace', 'multi-vendor', 'platform economy'],
  ['shopping cart', 'checkout', 'order management', 'oms'],
  ['catalog management', 'product catalog', 'pim', 'product information management'],
  ['dropshipping', 'third party logistics', '3pl', 'fulfillment center'],

  // ─── Education & EdTech ─────────────────────────────────────────────
  ['lms', 'learning management system', 'e-learning', 'online learning'],
  ['edtech', 'education technology', 'educational technology'],
  ['curriculum', 'course design', 'instructional design', 'content development'],
  ['assessment', 'testing', 'grading', 'proctoring', 'examination'],
  ['student engagement', 'learner experience', 'adaptive learning', 'personalized learning'],

  // ─── Real Estate & PropTech ─────────────────────────────────────────
  ['proptech', 'property technology', 'real estate tech'],
  ['property management', 'real estate management', 'asset management'],
  ['mls', 'multiple listing service', 'property listing', 'listing platform'],

  // ─── IoT & Hardware ─────────────────────────────────────────────────
  ['iot', 'internet of things', 'connected devices', 'smart devices'],
  ['embedded systems', 'firmware', 'rtos', 'microcontroller'],
  ['sensor', 'telemetry', 'edge computing', 'edge devices'],
  ['wearable', 'wearable technology', 'smart watch', 'fitness tracker'],

  // ─── Gaming ─────────────────────────────────────────────────────────
  ['game development', 'game design', 'game dev', 'gamedev', 'game lifecycle', 'game production', 'live ops', 'liveops', 'game economy', 'virtual economy', 'in-app purchase', 'iap', 'monetization', 'f2p', 'free to play', 'player engagement', 'retention mechanics', 'session length', 'dau', 'mau', 'level design', 'game balance', 'game analytics', 'playtesting'],
  ['unity', 'unreal engine', 'game engine', 'godot'],
  ['esports', 'competitive gaming', 'gaming ecosystem'],
  ['metaverse', 'virtual reality', 'vr', 'augmented reality', 'ar', 'xr', 'mixed reality'],

  // ─── Leadership & Management ────────────────────────────────────────
  ['team leadership', 'people management', 'team management', 'managing teams', 'team building'],
  ['hiring', 'recruitment', 'talent acquisition', 'interviewing', 'onboarding'],
  ['mentoring', 'coaching', 'mentorship', 'sponsorship'],
  ['cross-functional', 'cross functional', 'interdisciplinary', 'matrixed organization'],
  ['vendor management', 'vendor negotiations', 'partner management', 'partnership management'],
  ['executive leadership', 'c-suite', 'board reporting', 'executive communication'],
  ['conflict resolution', 'negotiation', 'stakeholder negotiation'],
  ['organizational design', 'team structure', 'org design', 'span of control'],

  // ─── OPT-6: Gaming Metrics (expanded) ──────────────────────────────
  ['dau', 'daily active users', 'active users', 'daily users'],
  ['mau', 'monthly active users', 'monthly users'],
  ['arpu', 'average revenue per user', 'revenue per user'],
  ['arppu', 'average revenue per paying user'],
  ['d1 retention', 'day-1 retention', 'day 1 retention', 'first day retention', 'day-7 retention', 'day 7 retention'],
  ['session length', 'session duration', 'time in app', 'engagement time'],
  ['virtual currency', 'virtual economy', 'in-game economy', 'token economy', 'in-app economy'],
  ['adtech', 'ad tech', 'advertising technology', 'ad monetization', 'ad sdk', 'ad network'],

  // ─── OPT-6: AgriTech / Agriculture ─────────────────────────────────
  ['precision agriculture', 'precision farming', 'smart farming', 'crop yield', 'agricultural supply chain', 'farm management'],
  ['agritech', 'agriculture technology', 'ag tech', 'farming technology'],

  // ─── OPT-6: Travel & Hospitality ───────────────────────────────────
  ['booking funnel', 'booking conversion', 'reservation funnel', 'purchase funnel', 'booking flow'],
  ['travel tech', 'travel technology', 'hospitality tech', 'hospitality technology'],
  ['gds', 'global distribution system', 'amadeus', 'sabre', 'travelport'],
  ['aov', 'average order value', 'basket size', 'order value'],
  ['cac', 'customer acquisition cost', 'cost per acquisition', 'cpa'],

  // ─── OPT-6: Cross-Domain User Engagement ───────────────────────────
  ['user engagement', 'engagement metrics', 'engagement rate', 'user activity', 'feature engagement'],
  ['onboarding', 'user onboarding', 'onboarding flow', 'activation', 'user activation'],
  ['churn rate', 'attrition rate', 'customer churn', 'user churn', 'churn analysis'],
  ['feature adoption', 'feature adoption rate', 'feature usage', 'feature penetration'],
  ['cart abandonment', 'checkout abandonment', 'drop-off rate', 'abandonment rate', 'checkout drop-off'],
  ['crash-free', 'crash free', 'crash-free session rate', 'app stability', 'crash rate'],
  ['localization', 'l10n', 'internationalization', 'i18n', 'regional languages', 'multi-language'],

  // ─── POWER UPGRADE: Marketplace & Retail (Target, Amazon, Flipkart-type roles) ──
  ['marketplace', 'marketplace platform', 'seller marketplace', 'vendor marketplace', 'multi-vendor marketplace'],
  ['seller', 'merchant', 'vendor', 'partner', 'third party seller', '3p seller', 'seller central'],
  ['seller experience', 'merchant experience', 'partner experience', 'seller portal'],
  ['product listing', 'catalog listing', 'item listing', 'sku management'],
  ['order management system', 'oms', 'order processing', 'order lifecycle'],
  ['system integration', 'api integration', 'middleware', 'enterprise integration', 'systems integration'],
  ['scalability', 'platform scalability', 'system scalability', 'scale', 'scaling'],
  ['compliance', 'regulatory compliance', 'policy compliance', 'platform compliance'],
  ['use cases', 'use case', 'business requirements document', 'brd', 'functional requirements'],
  ['acceptance criteria', 'definition of done', 'done criteria', 'acceptance testing'],
  ['product backlog', 'backlog management', 'backlog grooming', 'backlog refinement', 'backlog prioritization'],
  ['okr', 'objectives and key results', 'okrs', 'objective and key results'],
  ['product market fit', 'pmf', 'market fit', 'product-market fit'],
  ['0 to 1', 'zero to one', '0-1', 'greenfield', 'from scratch'],
  ['digital strategy', 'digital transformation', 'digital experience', 'digital platform'],
  ['personalization', 'personalisation', 'recommendation engine', 'personalized experience'],
  ['fulfillment', 'order fulfillment', 'fulfillment capabilities', 'fulfilment'],
  ['customer empathy', 'user empathy', 'customer obsession', 'customer-centric'],
  ['data driven prioritization', 'data-driven prioritization', 'data driven decisions', 'data-driven decisions'],
];

// Build a fast lookup: term → cluster index
const _synonymLookup = new Map();
SYNONYM_CLUSTERS.forEach((cluster, idx) => {
  cluster.forEach(term => _synonymLookup.set(term.toLowerCase(), idx));
});

/**
 * Expand a list of keywords by adding synonyms from known clusters.
 * Returns the original keywords plus their synonyms (deduplicated).
 */
export function expandSynonyms(keywords) {
  const expanded = new Set(keywords.map(k => k.toLowerCase()));
  for (const kw of keywords) {
    const clusterIdx = _synonymLookup.get(kw.toLowerCase());
    if (clusterIdx !== undefined) {
      SYNONYM_CLUSTERS[clusterIdx].forEach(syn => expanded.add(syn.toLowerCase()));
    }
  }
  return Array.from(expanded);
}

// ─── Semantic Keyword Tiering ─────────────────────────────────────────────

/**
 * Analyze a JD and classify extracted keywords into weighted tiers:
 *   must_have (3x weight) — after "required", "must have", "essential"
 *   preferred (2x weight) — after "preferred", "nice to have", "bonus"
 *   implied  (1x weight) — everything else
 */
export function buildSemanticKeywordMap(jdText) {
  const jdLower = jdText.toLowerCase();

  // Split JD into sections based on common headers
  const mustHavePatterns = [
    /(?:required|must[\s-]have|essential|mandatory|minimum|qualifications|requirements|what you[\s']ll need|what we[\s']re looking for|you have|you bring)[:\s]*([^]*?)(?=\n\n|preferred|nice[\s-]to|bonus|about|benefits|perks|$)/gi
  ];
  const preferredPatterns = [
    /(?:preferred|nice[\s-]to[\s-]have|bonus|plus|ideal|desired|additionally|good[\s-]to[\s-]have)[:\s]*([^]*?)(?=\n\n|about|benefits|perks|responsibilities|$)/gi
  ];

  let mustHaveText = '';
  let preferredText = '';

  for (const pattern of mustHavePatterns) {
    let m;
    while ((m = pattern.exec(jdLower)) !== null) {
      mustHaveText += ' ' + m[1];
    }
  }
  for (const pattern of preferredPatterns) {
    let m;
    while ((m = pattern.exec(jdLower)) !== null) {
      preferredText += ' ' + m[1];
    }
  }

  // Extract keywords from each section using TF-IDF
  const allKeywords = extractKeywords(jdText, 50);
  const mustHaveKeywords = mustHaveText ? extractKeywords(mustHaveText, 25) : [];
  const preferredKeywords = preferredText ? extractKeywords(preferredText, 15) : [];

  const mustHaveTerms = new Set(mustHaveKeywords.map(k => k.term.toLowerCase()));
  const preferredTerms = new Set(preferredKeywords.map(k => k.term.toLowerCase()));

  const result = { must_have: [], preferred: [], implied: [] };

  for (const kw of allKeywords) {
    const term = kw.term.toLowerCase();
    if (mustHaveTerms.has(term)) {
      result.must_have.push(term);
    } else if (preferredTerms.has(term)) {
      result.preferred.push(term);
    } else {
      result.implied.push(term);
    }
  }

  // If no sections detected, treat top 40% as must_have, next 30% as preferred
  if (result.must_have.length === 0 && result.preferred.length === 0) {
    const all = allKeywords.map(k => k.term.toLowerCase());
    const cutoff1 = Math.ceil(all.length * 0.4);
    const cutoff2 = Math.ceil(all.length * 0.7);
    result.must_have = all.slice(0, cutoff1);
    result.preferred = all.slice(cutoff1, cutoff2);
    result.implied = all.slice(cutoff2);
  }

  // Expand with synonyms
  result.must_have_expanded = expandSynonyms(result.must_have);
  result.preferred_expanded = expandSynonyms(result.preferred);
  result.implied_expanded = expandSynonyms(result.implied);

  return result;
}

// ─── Core TF-IDF Extraction ───────────────────────────────────────────────

/**
 * Extract top keywords from text using TF-IDF
 */
export function extractKeywords(text, topN = 30) {
  const tfidf = new TfIdf();
  tfidf.addDocument(text);

  const terms = [];
  tfidf.listTerms(0).forEach(item => {
    if (item.term.length > 2) {
      terms.push({ term: item.term, tfidf: item.tfidf });
    }
  });

  return terms.slice(0, topN);
}

// ─── Weighted Keyword Coverage ────────────────────────────────────────────

/**
 * Calculate WEIGHTED keyword coverage between resume text and tiered JD keywords.
 * v4: If requirementGraph is provided, uses 8-tier weights for precision scoring.
 * Fallback: Must-have = 3 points, Preferred = 2 points, Implied = 1 point.
 */
export function calculateKeywordCoverage(resumeText, jdKeywords, semanticMap = null, requirementGraph = null) {
  const resumeLower = resumeText.toLowerCase();
  const resumeTokens = new Set(
    tokenizer.tokenize(resumeLower).map(t => stemmer.stem(t))
  );

  // v4: Graph-aware scoring (most precise)
  if (requirementGraph && Array.isArray(requirementGraph)) {
    return _graphWeightedCoverage(resumeLower, resumeTokens, requirementGraph);
  }

  // If we have a semantic map, use weighted scoring
  if (semanticMap) {
    return _weightedCoverage(resumeLower, resumeTokens, semanticMap);
  }

  // Fallback: legacy flat scoring
  let matched = 0;
  const matchedKeywords = [];
  const missingKeywords = [];

  for (const keyword of jdKeywords) {
    if (_matchKeyword(keyword, resumeLower, resumeTokens)) {
      matched++;
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }

  return {
    coverage: jdKeywords.length > 0 ? matched / jdKeywords.length : 0,
    matched: matchedKeywords,
    missing: missingKeywords,
    total: jdKeywords.length,
    weighted_score: null
  };
}

/**
 * v4: 8-tier graph-aware weighted coverage.
 * Each requirement node carries its priority_tier and canonical form.
 */
function _graphWeightedCoverage(resumeLower, resumeTokens, graphNodes) {
  const TIER_WEIGHTS = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1.5, 6: 1, 7: 0.5, 8: 0 };
  let totalWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];
  const missingMustHaves = [];
  const missingByTier = {};
  const matchedFrequencies = {};

  for (const node of graphNodes) {
    if (node.priority_tier === 8) continue; // Skip noise entirely
    const weight = TIER_WEIGHTS[node.priority_tier] || 1;
    totalWeight += weight;

    // Check canonical + all raw mentions + synonym cluster
    let found = false;
    const allTerms = [node.canonical, ...(node.raw_mentions || [])];

    for (const term of allTerms) {
      if (_matchKeyword(term, resumeLower, resumeTokens)) {
        found = true;
        break;
      }
    }

    // Also check synonym cluster
    if (!found) {
      const clusterIdx = _synonymLookup.get(node.canonical.toLowerCase());
      if (clusterIdx !== undefined) {
        for (const syn of SYNONYM_CLUSTERS[clusterIdx]) {
          if (_matchKeyword(syn, resumeLower, resumeTokens)) {
            found = true;
            break;
          }
        }
      }
    }

    if (found) {
      matchedWeight += weight;
      matched.push(node.canonical);
      // Track frequency for stuffing detection
      const count = (resumeLower.match(new RegExp(`\\b${node.canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')) || []).length;
      if (count > 0) matchedFrequencies[node.canonical] = count;
    } else {
      missing.push(node.canonical);
      if (node.priority_tier <= 2) missingMustHaves.push(node.canonical);
      if (!missingByTier[node.priority_tier]) missingByTier[node.priority_tier] = [];
      missingByTier[node.priority_tier].push(node.canonical);
    }
  }

  return {
    coverage: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matched,
    missing,
    missing_must_haves: missingMustHaves,
    missing_by_tier: missingByTier,
    total: graphNodes.filter(n => n.priority_tier < 8).length,
    weighted_score: totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0,
    matched_frequencies: matchedFrequencies
  };
}

function _weightedCoverage(resumeLower, resumeTokens, semanticMap) {
  const WEIGHTS = { must_have: 3, preferred: 2, implied: 1 };
  let totalWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];
  const missingMustHaves = [];

  for (const tier of ['must_have', 'preferred', 'implied']) {
    const expandedKey = `${tier}_expanded`;
    const keywords = semanticMap[expandedKey] || semanticMap[tier] || [];
    const originalKeywords = semanticMap[tier] || [];
    const weight = WEIGHTS[tier];

    // Track which original keywords are matched via their expanded synonyms
    for (const origKw of originalKeywords) {
      totalWeight += weight;
      // Check original + all synonyms in its cluster
      const clusterIdx = _synonymLookup.get(origKw.toLowerCase());
      let found = false;

      if (_matchKeyword(origKw, resumeLower, resumeTokens)) {
        found = true;
      } else if (clusterIdx !== undefined) {
        for (const syn of SYNONYM_CLUSTERS[clusterIdx]) {
          if (_matchKeyword(syn, resumeLower, resumeTokens)) {
            found = true;
            break;
          }
        }
      }

      if (found) {
        matchedWeight += weight;
        matched.push(origKw);
      } else {
        missing.push(origKw);
        if (tier === 'must_have') missingMustHaves.push(origKw);
      }
    }
  }

  return {
    coverage: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matched,
    missing,
    missing_must_haves: missingMustHaves,
    total: (semanticMap.must_have?.length || 0) + (semanticMap.preferred?.length || 0) + (semanticMap.implied?.length || 0),
    weighted_score: totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0
  };
}

function _matchKeyword(keyword, resumeLower, resumeTokens) {
  const kwLower = keyword.toLowerCase();
  const kwWords = kwLower.split(/\s+/);
  const kwStemmed = kwWords.map(w => stemmer.stem(w));

  // Phrase match with word boundaries
  const escapedKw = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phraseRegex = new RegExp(`\\b${escapedKw}\\b`, 'i');
  if (phraseRegex.test(resumeLower)) return true;

  // Stemmed word match (all stems must be present)
  if (kwStemmed.every(s => resumeTokens.has(s))) return true;

  // Partial match for compound terms (e.g., "go-to-market" matches "go to market")
  const normalized = kwLower.replace(/[-_]/g, ' ');
  if (normalized !== kwLower && resumeLower.includes(normalized)) return true;

  // POWER UPGRADE: Slash/ampersand/symbol normalization
  // Catches: "A/B testing" ↔ "ab testing", "e-commerce" ↔ "ecommerce", "R&D" ↔ "r and d"
  const symbolNormalized = kwLower
    .replace(/[/&+]/g, ' ')   // A/B → A B, R&D → R D
    .replace(/[-_]/g, '')     // e-commerce → ecommerce
    .replace(/\s+/g, ' ')
    .trim();
  if (symbolNormalized !== kwLower && symbolNormalized.length > 1) {
    if (resumeLower.includes(symbolNormalized)) return true;
    // Also try the collapsed version (ecommerce, ab testing)
    const collapsed = kwLower.replace(/[-_/&+\s]/g, '');
    if (collapsed.length > 2 && resumeLower.includes(collapsed)) return true;
  }

  // POWER UPGRADE: Plural/singular equivalence
  // "APIs" ↔ "api", "user stories" ↔ "user story"
  if (kwLower.endsWith('s') && kwLower.length > 3) {
    const singular = kwLower.slice(0, -1);
    if (resumeLower.includes(singular)) return true;
  }
  if (kwLower.endsWith('ies') && kwLower.length > 4) {
    const singularY = kwLower.slice(0, -3) + 'y';
    if (resumeLower.includes(singularY)) return true;
  }
  // Reverse: check if resume has plural of keyword
  if (!kwLower.endsWith('s')) {
    if (resumeLower.includes(kwLower + 's')) return true;
  }

  // POWER UPGRADE: Substring match for very specific multi-word terms (3+ chars)
  // "system integration" matches resume containing "system integrations" or "systems integration"
  if (kwWords.length >= 2 && kwLower.length >= 8) {
    // Check each individual word (for multi-word terms, if ALL words appear anywhere, count it)
    if (kwWords.length <= 3 && kwWords.every(w => w.length > 2 && resumeLower.includes(w))) return true;
  }

  // N-Gram Proximity Matching for compound keywords
  if (kwWords.length > 1 && kwWords.length <= 4) {
    // Check if all words appear within a 6-word window
    const resumeWords = resumeLower.split(/\s+/);
    for (let i = 0; i < resumeWords.length - kwWords.length; i++) {
      const window = resumeWords.slice(i, i + Math.min(kwWords.length + 2, 6));
      const windowText = window.join(' ');
      if (kwWords.every(w => windowText.includes(w))) return true;
    }
  }

  return false;
}

// ─── TF-IDF Cosine Similarity ─────────────────────────────────────────────

/**
 * Calculate Structural TF-IDF cosine similarity between resume and JD
 * Now uses Unigrams, Bigrams, and Trigrams for high-fidelity structural matching.
 */
export function calculateTfIdfSimilarity(resumeText, jdText) {
  const tfidf = new TfIdf();
  
  // Use structural tokens to capture "machine_learning" instead of just "machine"
  const processedResume = extractStructuralTokens(resumeText);
  const processedJd = extractStructuralTokens(jdText);
  
  tfidf.addDocument(processedResume);
  tfidf.addDocument(processedJd);

  const allTerms = new Set();
  tfidf.listTerms(0).forEach(t => allTerms.add(t.term));
  tfidf.listTerms(1).forEach(t => allTerms.add(t.term));

  const vec1 = [];
  const vec2 = [];
  for (const term of allTerms) {
    vec1.push(tfidf.tfidf(term, 0));
    vec2.push(tfidf.tfidf(term, 1));
  }

  let dotProduct = 0, mag1 = 0, mag2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// ─── Multi-Dimensional Structural Correlation (L3) ────────────────────────
/**
 * Advanced correlation engine combining L1 (TF-IDF), L2 (Ontology), and L3 (Impact)
 */
export function calculateMultiDimensionalScore(candidateText, jdText, roleType = 'engineer') {
  const jdLower = jdText.toLowerCase();
  
  // 1. L1: Structural TF-IDF (Exact Match + N-Grams)
  const l1Score = calculateTfIdfSimilarity(candidateText, jdText) * 100;
  
  // 2. L2: Ontological Synonym Correlation
  // Check if JD mentions the exact parent, OR if it mentions any of the children
  let l2Score = 0;
  let ontologyHits = 0;
  
  for (const [parentDomain, children] of Object.entries(ONTOLOGY_GRAPH)) {
    const parentWords = parentDomain.toLowerCase().replace(/&/g, '').split(' ').filter(w => w.length > 2);
    
    // Check if the JD belongs to this domain by checking parent words or children
    const jdInDomain = parentWords.some(w => jdLower.includes(w)) || children.some(c => jdLower.includes(c.toLowerCase()));
    
    if (jdInDomain) {
      // If JD is in this domain, check if candidate text has other related children
      for (const child of children) {
        if (candidateText.toLowerCase().includes(child.toLowerCase())) {
          ontologyHits++;
        }
      }
    }
  }
  // Max out at 5 ontology correlations
  l2Score = Math.min(100, ontologyHits * 20);

  // 3. L3: Impact Vector (XYZ Formula & Metrics)
  const impactStats = scoreBusinessImpact(candidateText);
  const l3Score = impactStats.score;

  // 4. Role-Based Dimensional Weighting
  let weights = { l1: 0.70, l2: 0.15, l3: 0.15 }; // Default (Engineering)
  
  const role = roleType.toLowerCase();
  if (role.includes('product') || role.includes('manager')) {
    // PMs need more impact and lateral domain knowledge
    weights = { l1: 0.50, l2: 0.25, l3: 0.25 };
  } else if (role.includes('sales') || role.includes('marketing')) {
    // Sales needs massive impact (numbers, quotas)
    weights = { l1: 0.40, l2: 0.20, l3: 0.40 };
  } else if (role.includes('design') || role.includes('ux')) {
    // Designers lean heavily on L1 and L2 (skills and related domains)
    weights = { l1: 0.60, l2: 0.30, l3: 0.10 };
  }

  const finalScore = (l1Score * weights.l1) + (l2Score * weights.l2) + (l3Score * weights.l3);

  return {
    combined_score: finalScore,
    l1_tfidf: l1Score,
    l2_ontology: l2Score,
    l3_impact: l3Score,
    weights_applied: weights
  };
}

// ─── Business Impact Scoring ──────────────────────────────────────────────

/**
 * Score business impact — detects Google XYZ formula bullets:
 * "Accomplished [X] as measured by [Y], by doing [Z]"
 * Scores presence of metrics, dollar amounts, percentages, multipliers.
 *
 * FIX: Raised minimum fragment length from 20→50 to skip skill-list fragments
 * and section headers that were creating "phantom weak bullets". Also filters
 * out comma-heavy fragments (skill lists) that aren't real experience bullets.
 */
export function scoreBusinessImpact(text) {
  const rawFragments = text.split(/[;.!]\s+/).filter(s => s.trim().length > 50);

  // Filter out skill-list fragments (contain many commas or pipe separators)
  // and fragments that are clearly section headers or labels
  const bullets = rawFragments.filter(frag => {
    const commaCount = (frag.match(/,/g) || []).length;
    const wordCount = frag.split(/\s+/).length;
    // If more than 40% of words are separated by commas, it's a skill list
    if (commaCount > 0 && commaCount / wordCount > 0.4) return false;
    // Skip pipe-separated lists
    if ((frag.match(/\|/g) || []).length > 2) return false;
    // Skip fragments that start with common section-header words
    const trimmed = frag.trim().toLowerCase();
    if (/^(skills|tools|domain|expertise|education|languages|interests|recognition|leadership|consulting)/i.test(trimmed)) return false;
    return true;
  });

  let bulletsWithMetrics = 0;
  let totalBullets = bullets.length;
  const weakBullets = [];

  // Enhanced metric patterns
  const metricPatterns = [
    /\d+[\s]*[%xX×]/,             // 20%, 3x, 10X
    /\$[\d,.]+[KkMmBb]?/,         // $100K, $1.3M
    /Rs\.?\s*[\d,.]+/,             // Rs. 4.18M
    /INR\s*[\d,.]+/,               // INR 70K
    /\d+[KkMmBb]\+?/,             // 50K+, 2M+
    /\d+\s*(?:Cr|Lakh|L)\+?/i,    // 10Cr+, 5L+
    /\d+\.\d+/,                    // 99.5 (precision metrics)
    /\d+\s*(?:days?|weeks?|months?|hours?)\b/i, // time-based metrics
    /(?:increased|decreased|improved|reduced|boosted|grew|cut|saved)\s.*?\d/i, // action + number
  ];

  for (const bullet of bullets) {
    const hasMetric = metricPatterns.some(p => p.test(bullet));
    if (hasMetric) {
      bulletsWithMetrics++;
    } else if (bullet.length > 60) {
      // Only flag genuinely long text without metrics as weak
      weakBullets.push(bullet.substring(0, 80) + '...');
    }
  }

  const metricDensity = totalBullets > 0 ? bulletsWithMetrics / totalBullets : 0;
  const score = Math.min(100, Math.round(metricDensity * 100));

  return {
    score,
    bullets_with_metrics: bulletsWithMetrics,
    total_bullets: totalBullets,
    metric_density: Math.round(metricDensity * 100),
    weak_bullets: weakBullets.slice(0, 5)
  };
}

// ─── Quantification Scoring ───────────────────────────────────────────────

/**
 * Score quantified achievements (numbers, percentages, metrics)
 * OPT-9: Pre-normalizes LaTeX escapes for reliable metric detection.
 */
export function scoreQuantification(text) {
  // OPT-9: Normalize LaTeX escapes before metric detection
  const cleanText = text
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\&/g, '&');

  const metrics = cleanText.match(/\d+(?:[%+x])|(?:\$[\d,.]+[KkMmBb]?)|(?:Rs\.?\s*[\d,.]+)|(?:\d+[KkMmBb]+\+?)|(?:\d+\.\d+)/g) || [];
  const percentages = cleanText.match(/\d+%/g) || [];
  const multipliers = cleanText.match(/\d+x/gi) || [];
  const timeMetrics = cleanText.match(/\d+\s*(?:days?|weeks?|months?|hours?)\b/gi) || [];

  let score = metrics.length * 8;
  // Bonus for percentages and multipliers (showing impact)
  if (percentages.length > 0) score += 10;
  if (multipliers.length > 0) score += 10;
  if (timeMetrics.length > 0) score += 5; // Bonus for time-based metrics

  return {
    total_metrics: metrics.length,
    percentages: percentages.length,
    multipliers: multipliers.length,
    time_metrics: timeMetrics.length,
    score: Math.min(100, score)
  };
}

// ─── Seniority Alignment ──────────────────────────────────────────────────

/**
 * Score whether resume language matches the expected seniority level.
 */
export function scoreSeniorityAlignment(text, seniorityLevel) {
  const textLower = text.toLowerCase();

  const seniorityVocab = {
    senior: {
      strong: [
        'led', 'owned', 'drove', 'architected', 'scaled', 'spearheaded', 'orchestrated',
        'established', 'pioneered', 'transformed', 'defined', 'formulated', 'delivered',
        'managed', 'directed', 'launched', 'built', 'founded', 'secured', 'attained',
        'negotiated', 'originated', 'conceptualized', 'devised', 'modernized', 'championed',
        'strategized', 'steered', 'maximized', 'governed', 'overhauled'
      ],
      weak: [
        'helped', 'assisted', 'supported', 'participated', 'contributed to', 'worked on',
        'was involved', 'was responsible for', 'aided', 'was a part of'
      ]
    },
    lead: {
      strong: [
        'led', 'owned', 'drove', 'architected', 'scaled', 'spearheaded', 'orchestrated',
        'established', 'pioneered', 'transformed', 'mentored', 'hired', 'coached',
        'facilitated', 'guided', 'directed', 'supervised', 'empowered', 'cultivated'
      ],
      weak: ['helped', 'assisted', 'supported', 'participated', 'worked on']
    },
    mid: {
      strong: [
        'designed', 'implemented', 'optimized', 'developed', 'built', 'integrated',
        'authored', 'executed', 'analyzed', 'delivered', 'improved', 'maintained',
        'tested', 'researched', 'operated', 'coordinated', 'configured', 'resolved',
        'deployed', 'administered', 'programmed', 'audited', 'streamlined'
      ],
      weak: ['helped', 'assisted', 'was responsible for', 'was involved', 'aided']
    },
    junior: {
      strong: [
        'contributed', 'supported', 'assisted', 'developed', 'implemented', 'analyzed',
        'drafted', 'prepared', 'processed', 'researched', 'gathered', 'compiled',
        'monitored', 'documented', 'updated', 'maintained'
      ],
      weak: [] // For juniors, these words are acceptable, no weak penalty
    },
    director: {
      strong: [
        'led', 'owned', 'drove', 'scaled', 'established', 'transformed', 'pioneered',
        'defined', 'formulated', 'orchestrated', 'directed', 'managed', 'launched',
        'secured', 'built', 'founded', 'governed', 'advised', 'oversaw', 'expanded',
        'restructured', 'championed', 'spearheaded', 'navigated'
      ],
      weak: [
        'helped', 'assisted', 'supported', 'participated', 'contributed to', 'worked on',
        'developed', 'implemented', 'maintained', 'tested' // Directors shouldn't be IC coding/doing
      ]
    }
  };

  const level = (seniorityLevel || 'senior').toLowerCase();
  const vocab = seniorityVocab[level] || seniorityVocab.senior;

  let strongCount = 0;
  let weakCount = 0;

  for (const v of vocab.strong) {
    const regex = new RegExp(`\\b${v}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches) strongCount += matches.length;
  }
  for (const v of vocab.weak) {
    const regex = new RegExp(`\\b${v}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches) weakCount += matches.length;
  }

  const total = strongCount + weakCount;
  const ratio = total > 0 ? strongCount / total : 0.5;
  const score = Math.min(100, Math.round(ratio * 100));

  return {
    score,
    strong_verb_count: strongCount,
    weak_verb_count: weakCount,
    ratio: Math.round(ratio * 100),
    seniority_level: level,
    mismatches: weakCount > 0 ? vocab.weak.filter(v => textLower.includes(v)) : []
  };
}

// ─── Leadership Scoring ───────────────────────────────────────────────────

/**
 * Score leadership language presence
 */
export function scoreLeadership(text) {
  const leadershipVerbs = [
    'led', 'managed', 'directed', 'mentored', 'coached', 'scaled',
    'hired', 'built', 'founded', 'architected', 'orchestrated',
    'spearheaded', 'drove', 'established', 'transformed', 'owned',
    'bootstrapped', 'delivered', 'launched', 'pioneered', 'governed',
    'oversaw', 'championed', 'steered', 'guided', 'supervised', 'empowered',
    'cultivated', 'facilitated', 'navigated', 'restructured', 'advised'
  ];
  const textLower = text.toLowerCase();
  let score = 0;
  const found = [];

  for (const verb of leadershipVerbs) {
    if (textLower.includes(verb)) {
      score += 5;
      found.push(verb);
    }
  }

  return { score: Math.min(100, score), verbs_found: found };
}

// ─── Action Verb Scoring ──────────────────────────────────────────────────

/**
 * Score action verb strength
 */
export function scoreActionVerbs(text) {
    const powerVerbs = [
      // Universal Power Verbs
      'achieved', 'accelerated', 'automated', 'boosted', 'consolidated',
      'delivered', 'drove', 'eliminated', 'engineered', 'executed',
    'generated', 'implemented', 'increased', 'launched', 'maximized',
    'optimized', 'pioneered', 'reduced', 'revolutionized', 'secured',
    'streamlined', 'transformed', 'unified', 'architected', 'defined',
    'designed', 'authored', 'conducted', 'integrated', 'formulated',
    'spearheaded', 'orchestrated', 'scaled', 'established',
    // Engineering & Data
    'programmed', 'deployed', 'configured', 'migrated', 'refactored', 'debugged',
    // Design & UX
    'wireframed', 'prototyped', 'conceptualized', 'visualized', 'ideated',
    // Sales, Marketing & Biz
    'negotiated', 'converted', 'acquired', 'retained', 'monetized', 'capitalized',
    'forecasted', 'audited', 'reconciled', 'marketed', 'promoted', 'positioned',
    // Operations & Legal
    'standardized', 'systematized', 'regulated', 'mitigated', 'safeguarded', 'enforced'
  ];
  const weakVerbs = [
    'helped', 'assisted', 'worked on', 'was responsible for',
    'participated in', 'involved in', 'contributed to'
  ];

  const textLower = text.toLowerCase();
  let powerCount = 0;
  let weakCount = 0;

  for (const v of powerVerbs) { if (textLower.includes(v)) powerCount++; }
  for (const v of weakVerbs) { if (textLower.includes(v)) weakCount++; }

  const total = powerCount + weakCount;
  return {
    score: total > 0 ? Math.min(100, (powerCount / total) * 100) : 50,
    power_verbs: powerCount,
    weak_verbs: weakCount
  };
}

// ─── Project Ranking ──────────────────────────────────────────────────────

/**
 * Rank projects from obsidian brain against JD using keyword overlap + tag matching
 */
export function rankProjects(projects, jdText, jdKeywords) {
  const jdLower = jdText.toLowerCase();
  const expandedKeywords = expandSynonyms(jdKeywords);

  const projectScores = projects.map(project => {
    const projectText = [
      project.name || '',
      project.one_liner || project.subtitle || '',
      project.pitch || '',
      project.usp || '',
      ...(project.domains || []),
      ...(project.technologies || []),
      ...(project.searchable_keywords || []),
      ...(project.kpis || []),
      ...(project.problems_solved || []),
      ...(project.bullets || []).slice(0, 6)  // Include top bullets for matching
    ].join(' ').toLowerCase();

    // Calculate keyword overlap (with synonyms)
    let keywordHits = 0;
    const matchedKws = [];
    for (const kw of expandedKeywords) {
      if (projectText.includes(kw.toLowerCase())) {
        keywordHits++;
        matchedKws.push(kw);
      }
    }

    // Reverse match: how much project text appears in JD
    const projectTokens = tokenizer.tokenize(projectText);
    let reverseHits = 0;
    for (const token of projectTokens) {
      if (token.length > 3 && jdLower.includes(token)) reverseHits++;
    }

    // Explicit Impact Scoring (Metrics & Numbers)
    let impactScore = 0;
    const hasNumbers = /\d+/.test(projectText);
    if (hasNumbers) impactScore += 2;
    if (project.kpis && project.kpis.length > 0) impactScore += (project.kpis.length * 1.5);
    const impactTerms = ['increased', 'decreased', 'reduced', 'improved', 'revenue', 'growth', 'scale', 'users'];
    for (const term of impactTerms) {
      if (projectText.includes(term)) impactScore += 0.5;
    }

    // Weighting: 60% Keyword Relevance, 20% Reverse JD Match, 20% Business Impact
    const combined_score = (keywordHits * 2.0) + (reverseHits * 0.1) + (impactScore * 1.5);

    return {
      id: project.id,
      name: project.name,
      keyword_hits: keywordHits,
      reverse_hits: reverseHits,
      matched_keywords: matchedKws,
      keyword_score: expandedKeywords.length > 0 ? keywordHits / expandedKeywords.length : 0,
      combined_score: combined_score
    };
  });

  projectScores.sort((a, b) => b.combined_score - a.combined_score);
  return projectScores;
}

// ─── Readability Scoring ──────────────────────────────────────────────────

/**
 * Calculate readability score
 */
export function scoreReadability(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = tokenizer.tokenize(text);
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;

  let score = 100;
  if (avgWordsPerSentence > 25) score -= (avgWordsPerSentence - 25) * 3;
  if (avgWordsPerSentence < 8) score -= (8 - avgWordsPerSentence) * 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    avg_words_per_sentence: Math.round(avgWordsPerSentence * 10) / 10,
    sentence_count: sentences.length,
    word_count: words.length
  };
}

// ─── Entity Extraction ────────────────────────────────────────────────────

/**
 * Extract entities using compromise NLP
 */
export function extractEntities(text) {
  const doc = nlp(text);
  return {
    organizations: doc.organizations().out('array'),
    people: doc.people().out('array'),
    places: doc.places().out('array'),
    topics: doc.topics().out('array'),
    nouns: doc.nouns().out('array').slice(0, 20)
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────

const nlpScorer = {
  extractKeywords, calculateKeywordCoverage, calculateTfIdfSimilarity,
  scoreQuantification, scoreLeadership, scoreActionVerbs,
  rankProjects, extractEntities, scoreReadability,
  // v2 additions
  buildSemanticKeywordMap, expandSynonyms, scoreBusinessImpact, scoreSeniorityAlignment,
  // v3 Multi-Dimensional Structured Additions
  extractStructuralTokens, calculateMultiDimensionalScore
};
export default nlpScorer;

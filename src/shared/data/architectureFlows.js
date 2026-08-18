export const systemFlows = [
  {
    id: 'global',
    title: '5.1 Global Sub-System Interconnection Diagram',
    description: 'Get My Job is a distributed, multi-agent enterprise-grade autonomous career operating system. It orchestrates the entire job search lifecycle by eliminating manual intervention in application workflows.',
    mermaid: `graph TD
    subgraph DataSourcing ["1. Data Sourcing & Intake Tier"]
        Scraper["Job Discovery Engine"] -->|"Raw HTML"| Parser["Intelligence Engine"]
        Obsidian["Obsidian Vault Loader"] -->|"Markdown"| Brain["Knowledge Graph Engine"]
    end
    
    subgraph DatabaseTier ["2. Central State & Vector Tier"]
        Parser -->|"Upsert Validated JD"| DB[("Relational Database")]
        Brain -->|"Batch Vectorize"| VDB[("Vector Embeddings Store")]
    end
    
    subgraph PreFlightTier ["3. Data Quality & Pre-Flight Tier"]
        DB -->|"Trigger App Worker"| PreFlight["Pre-Flight Quality Engine"]
        PreFlight -->|"Quality OK"| Tailor["Get My Job AI Tailor Engine"]
    end
    
    subgraph CognitiveTier ["4. Cognitive Tailoring & Validation Tier"]
        VDB <-->|"Semantic Search"| Tailor
        Tailor -->|"70B Debate Loop"| Output["Output Validator Engine"]
        Output --> Personalization["Cover Letter Engine"]
    end
    
    subgraph LayoutTier ["5. Aesthetic & Layout Tier"]
        Output --> Layout["Widow Optimizer Engine"]
        Layout --> LaTeX["LaTeX Generation Engine"]
    end
    
    subgraph ExecutionTier ["6. Execution & Delivery Tier"]
        LaTeX -->|"PDF Output"| Delivery["ATS/Email Delivery Engine"]
        Personalization -->|"MIME Text Body"| Delivery
        Batch["Batch Execution Engine"] --> Delivery
    end
    
    subgraph SyncTier ["7. Synchronization & RLHF Tier"]
        Delivery -->|"Submits Application"| Target["Recruiter / ATS Inbox"]
        Target -->|"Replies"| Sync["Inbox Sync Engine"]
        Sync -->|"Intent (Interview/Reject)"| DB
        Sync -->|"Trigger"| RLHF["RLHF Feedback Engine"]
        RLHF -->|"Boost Weights"| VDB
    end`
  },
  {
    id: 'discovery',
    title: '6.1 Job Discovery & Scraping Engine',
    description: 'A continuous polling background daemon utilizing Python headless bindings and proxied requests to scrape fragmented job boards. Manual job sourcing is incredibly slow. This engine discovers, aggregates, and deduplicates opportunities autonomously.',
    mermaid: `sequenceDiagram
    participant Worker as Stealth Scraper
    participant Board as Job Board DOM
    participant Normalizer as URL Normalizer
    participant DB as Jobs Database

    Worker->>Board: Navigate (Rotating Proxies)
    Board-->>Worker: Raw Target Links
    Worker->>Normalizer: Clean Tracking Query Params
    Normalizer->>Normalizer: Generate MD5 Hash
    Normalizer->>DB: Check Hash Existence
    alt Hash exists
        DB-->>Normalizer: Duplicate
        Normalizer->>Normalizer: Silently Drop
    else New Entry
        Normalizer->>DB: Upsert to DB
    end`
  },
  {
    id: 'parsing',
    title: '6.2 Data Parsing & Intelligence Engine',
    description: 'A deterministic text extraction and NLP pipeline. Job descriptions are noisy. The AI tailor cannot perform accurately if fed copyright footers or EEO boilerplate.',
    mermaid: `flowchart TD
    RawHTML["Raw Job HTML"] --> Parser["deterministicJDParser.js"]
    Parser -->|"Strip Noise & Boilerplate"| CleanText["Clean JD Text"]
    
    CleanText --> Salary["salary-extractor.js"]
    CleanText --> Company["companyNameResolver.js"]
    
    Salary -->|"Regex Match: $100k-$150k"| ExtractedData["JSON Payload"]
    Company -->|"Regex Match: Apple Inc."| ExtractedData
    
    ExtractedData --> DB[("Database")]`
  },
  {
    id: 'knowledge',
    title: '6.3 Profile & Knowledge Graph Engine (Obsidian Brain Builder)',
    description: 'The ingestion system for the user\'s past experience. Traditional static resumes are inadequate. The system needs a granular database of every single project, metric, and skill.',
    mermaid: `flowchart TD
    Upload["Raw Markdown Vault"] --> Parser["VaultParser.js"]
    Parser --> Validator["VaultValidator.js"]
    Validator -->|"Passed"| Builder["brainBuilder.js"]
    
    Builder --> E["Experience Layer"]
    Builder --> P["Projects Layer"]
    Builder --> S["Skills Layer"]
    
    E --> Output["Structured User JSON"]
    P --> Output
    S --> Output`
  },
  {
    id: 'vectors',
    title: '6.4 Vector Embeddings & Retrieval Engine',
    description: 'When a JD mentions "Redis", the system needs to mathematically find the specific past projects where the user utilized Redis or similar in-memory caches using Cosine Similarity.',
    mermaid: `flowchart LR
    Profile["Structured User JSON"] --> VB["vectorBrain.js"]
    VB -->|"Batch Call"| Embed["Embeddings Model"]
    Embed --> VDB[("Vector Store")]
    
    JD["JD Data"] --> Query["Cosine Similarity Query"]
    Query --> VDB
    VDB -->|"Top K Nearest Neighbors"| Match["Relevant Projects Array"]`
  },
  {
    id: 'preflight',
    title: '6.5 Pre-Flight & Quality Validation Engine',
    description: 'A strict, non-AI deterministic validator block. AI models hallucinate when fed insufficient or low-quality data. This acts as a circuit breaker.',
    mermaid: `sequenceDiagram
    participant Worker as Application Flow
    participant PF as strictPreFlightValidator.js
    participant Brain as Obsidian Brain Data
    participant JD as Extracted JD
    participant DB as Postgres

    Worker->>PF: Trigger runPreFlightValidation()
    PF->>Brain: Check minimum bullet counts & arrays
    PF->>JD: Check minimum character limits
    alt FATAL Errors detected
        PF-->>Worker: RETURN {valid: false, errors: [...]}
        Worker->>DB: Log Pipeline Failure & Halt
    else Only Warnings / Success
        PF-->>Worker: RETURN {valid: true}
        Worker->>Tailor: Proceed to Cognitive Generation
    end`
  },
  {
    id: 'tailor',
    title: '6.6 The Get My Job AI Tailor Engine',
    description: 'The cognitive core of the platform. A multi-agent consensus system to rewrite, re-weight, and restructure the user\'s resume bullet points to perfectly match the target job description.',
    mermaid: `flowchart TD
    Retrieved["Relevant Projects Array"] --> SA["deterministicSkillsArchitect.js"]
    SA --> BE["deterministicBulletEngineer.js"]
    
    subgraph Parallel Variants
        BE -->|"T=0.15"| V1["Variant 1"]
        BE -->|"T=0.25"| V2["Variant 2"]
        BE -->|"T=0.35"| V3["Variant 3"]
    end
    
    V1 --> CL["consensusLoop.js"]
    V2 --> CL
    V3 --> CL
    
    subgraph 70B Multi-Agent Debate
        CL --> R["Virtual Recruiter"]
        CL --> TL["Virtual Tech Lead"]
        CL --> HM["Virtual Hiring Manager"]
    end
    
    R --> Vote["Consensus Selection"]
    TL --> Vote
    HM --> Vote
    
    Vote --> Final["Drafted JSON Output"]`
  },
  {
    id: 'validator',
    title: '6.7 Output Validator Engine',
    description: 'A post-generation deterministic validator. Even with a 70B debate loop, models can still hallucinate non-existent projects or generate passive, weak bullet points.',
    mermaid: `flowchart TD
    DraftJSON["Drafted JSON Output"] --> Validator["strictOutputValidator.js"]
    Validator -->|"Check 1"| Voice["Flag Passive Voice"]
    Validator -->|"Check 2"| Verbs["Require Strong Action Verbs"]
    Validator -->|"Check 3"| Metrics["Require Quantitative Data"]
    Validator -->|"Check 4"| Integrity["Verify Skills/Projects match Brain DB"]
    Integrity -- Hallucination Found --> Error["Throw Error / Retry Generation"]
    Integrity -- Validated --> Output["Perfected JSON Profile"]`
  },
  {
    id: 'optimizer',
    title: '6.8 Line-Width & Aesthetics Engine (Widow Optimizer)',
    description: 'A programmatic physical layout adjustment pipeline. Resumes look terrible when a 160-character sentence wraps to a new line just to display 3 orphaned words. This engine forces aesthetic perfection.',
    mermaid: `flowchart LR
    PerfectJSON["Perfected JSON Profile"] --> Detector["widow_detector.py"]
    Detector -->|"Calculate Character Render Lengths"| Check{"Orphan/Widow Detected?"}
    
    Check -- Yes (Awkward Wrap) --> Optimizer["widow_optimizer.py"]
    Optimizer -->|"Re-phrase for optimal width"| Adjust["Inject adjusted text"]
    Adjust --> LayoutJSON["Aesthetically Perfect JSON"]
    
    Check -- No (Clean Wrap) --> LayoutJSON`
  },
  {
    id: 'latex',
    title: '6.9 Document Generation Engine (LaTeX Compiler)',
    description: 'A local OS-level LaTeX rendering pipeline. To produce a pixel-perfect, ATS-readable PDF that fits exactly on one page, bypassing the inaccuracies of HTML-to-PDF converters.',
    mermaid: `sequenceDiagram
    participant Engine as latex-compiler.js
    participant Parser as latexExtractor.js
    participant OS as pdflatex (System Shell)
    participant Bucket as Cloud Storage

    Engine->>Parser: Ingest Layout JSON
    Parser->>Parser: Escape Special Characters
    Parser->>Engine: Inject into .tex file
    Engine->>OS: execFileSync(pdflatex template.tex)
    OS-->>Engine: Compiled Binary .pdf Buffer
    Engine->>Bucket: Upload Snapshot
    Bucket-->>Engine: Return Persistent URL`
  },
  {
    id: 'coverletter',
    title: '6.10 Cover Letter & Personalization Engine',
    description: 'Generates highly contextualized email bodies. To ensure that the outbound email to the recruiter reads authentically and references exact overlaps.',
    mermaid: `flowchart LR
    Email["j.doe@apple.com"] --> Resolver["email_name_extractor.py"]
    Resolver -->|"John"| CLG["coverLetterGenerator.js"]
    
    CompanyCtx["Company Details"] --> PE["personalizationEngine.js"]
    PE --> CLG
    
    CLG -->|"Generate Text"| Output["Tailored Email Body"]`
  },
  {
    id: 'delivery',
    title: '6.11 Delivery & ATS Injection Engine',
    description: 'The single-dispatch module. Handles the physical act of submitting the application, ensuring high deliverability and fallback mechanisms.',
    mermaid: `flowchart TD
    Trigger["Application Dispatch Trigger"] --> Type{Is Target Email or ATS URL?}
    
    Type -- Email --> MIME["Construct MIME Payload"]
    MIME --> Gmail["Attempt Gmail API"]
    Gmail -- Fails --> SMTP["Fallback to native SMTP"]
    
    Type -- ATS URL --> Playwright["ats-automation (Playwright Worker)"]
    Playwright --> Navigate["Navigate DOM"]
    Navigate --> Fill["Inject Form Payload"]
    
    SMTP --> DBWrite["dualWrite.js (Update State)"]
    Gmail -- Succeeds --> DBWrite
    Fill -- Succeeds --> DBWrite`
  },
  {
    id: 'batch',
    title: '6.12 Batch Execution Engine',
    description: 'A bulk-processing pipeline orchestrator. Applying to 50 jobs one-by-one is tedious. This engine allows users to queue hundreds of roles and process them completely autonomously overnight.',
    mermaid: `sequenceDiagram
    participant Batch as batch_apply.mjs
    participant DB as Postgres
    participant Pipeline as Application Pipeline

    Batch->>DB: Select top 50 PENDING jobs
    DB-->>Batch: Array of Jobs
    loop For Each Job
        Batch->>Pipeline: Execute Full Pipeline
        alt Pipeline Success
            Pipeline-->>Batch: 200 OK
            Batch->>DB: Update Status to SENT
        else Pipeline Failure
            Pipeline-->>Batch: Error Context
            Batch->>DB: Update Status to FAILED
        end
    end`
  },
  {
    id: 'sync',
    title: '6.13 Stateless Inbox Synchronization Engine',
    description: 'A continuous polling system. Application tracking spreadsheets are universally abandoned by users. This treats the user\'s inbox as the ultimate source of truth, automating Kanban board updates.',
    mermaid: `sequenceDiagram
    participant Mail as Gmail API
    participant Sync as imap-client.js
    participant Analyzer as email-analyzer (LLM)
    participant DB as Postgres
    participant UI as Command Center UI

    Sync->>Mail: Poll Unread (Every 5 mins)
    Mail-->>Sync: Return Messages
    Sync->>Sync: Extract Domain & Headers
    Sync->>DB: Query job_id by Domain
    alt Valid Job Found
        Sync->>Analyzer: Pass Body Text
        Analyzer-->>Sync: Return Status (e.g. INTERVIEW)
        Sync->>DB: Update job.status = INTERVIEW
        DB-->>UI: Real-Time Edge Broadcast
        UI->>UI: Visually update Kanban Column
    else No Match
        Sync->>Sync: Silently Drop
    end`
  },
  {
    id: 'multi-backend',
    title: '7.1 Multi-Backend Adapter Architecture',
    description: 'Get My Job implements a highly decoupled Adapter Pattern for its database layer, allowing seamless switching between different backend environments using a single environment variable.',
    mermaid: `classDiagram
    class DatabaseAdapter {
        <<interface>>
        +create(table, data)
        +findById(table, id)
        +update(table, id, data)
        +query(table, field, value)
    }
    
    class SupabaseFirestoreAdapter {
        -supabaseClient
    }
    class FirebaseEmulatorAdapter {
        -firebaseDb
    }
    class DynamoDBAdapter {
        -dynamoClient
    }
    
    DatabaseAdapter <|-- SupabaseFirestoreAdapter
    DatabaseAdapter <|-- FirebaseEmulatorAdapter
    DatabaseAdapter <|-- DynamoDBAdapter
    
    class withAuth {
        +executeRoute()
    }
    
    withAuth --> DatabaseAdapter : Instantiates based on BACKEND_METHOD`
  }
];

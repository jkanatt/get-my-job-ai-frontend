/**
 * Get My Job Resume Intelligence Engine — Local Edition
 * =================================================
 * 100% local, zero-API, unlimited resume extraction pipeline.
 * Uses regex patterns + NLP (compromise, natural) for structured extraction.
 * 
 * Supported formats: PDF (text-based), DOCX, LaTeX (.tex), TXT, Markdown
 * AI Provider: NONE — fully offline, free, unlimited
 * 
 * Architecture:
 *   Upload → Format Detection → Text Extraction → Regex/NLP Structuring → Validation → Output
 */

// GoogleGenAI import removed — resume-parser now delegates to Global LLM Engine v5

// ═══════════════════════════════════════════════════════════
// 1. TEXT EXTRACTION — PDF
// ═══════════════════════════════════════════════════════════

/**
 * Extract text from a PDF buffer using pdf-parse (primary) with regex fallback.
 */
export async function extractTextFromPDF(buffer) {
  const errors = [];

  // ── Method 0: Baidu Unlimited-OCR via HuggingFace Space (FIRST PREFERENCE) ──
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (hfKey) {
    try {
      const { Client } = await import('@gradio/client');
      const { fromBuffer } = await import('pdf2pic');

      // Convert first 3 PDF pages to images for the vision model
      const convert = fromBuffer(buffer, {
        density: 300,
        saveFilename: 'unlimited_ocr',
        savePath: '/tmp',
        format: 'png',
        width: 2550,
        height: 3300
      });

      const allText = [];
      const maxPages = 3;

      // Connect to the Baidu Unlimited-OCR HuggingFace Space
      const client = await Client.connect("baidu/Unlimited-OCR", {
        hf_token: hfKey
      });

      for (let page = 1; page <= maxPages; page++) {
        try {
          const imgResult = await convert(page, { responseType: 'base64' });
          if (!imgResult?.base64) break;

          // Convert base64 to a Blob for Gradio
          const imgBuffer = Buffer.from(imgResult.base64, 'base64');
          const blob = new Blob([imgBuffer], { type: 'image/png' });

          const result = await client.predict("/run", {
            image: blob,
            prompt: "document parsing.",
          });

          const pageText = (result?.data?.[0] || result?.data || '').toString().trim();
          if (pageText.length > 20) {
            allText.push(pageText);
          }
        } catch (pageErr) {
          // Page doesn't exist or Space is busy — stop
          if (page === 1) throw pageErr; // If even page 1 fails, cascade to next engine
          break;
        }
      }

      const combinedText = allText.join('\n\n').trim();
      if (combinedText.length >= 50) {
        console.log(`[Get My Job] ✓ Unlimited-OCR extracted ${combinedText.length} chars from ${allText.length} pages`);
        return { text: combinedText, method: 'unlimited-ocr', chars: combinedText.length };
      }
      errors.push(`unlimited-ocr returned only ${combinedText.length} chars`);
    } catch (err) {
      console.log('[Get My Job] Unlimited-OCR unavailable, falling back:', err.message);
      errors.push(`unlimited-ocr failed: ${err.message}`);
    }
  }

  // ── Method 0.5: DeepSeek-OCR-2 via HuggingFace Space (2nd preference) ──
  if (hfKey) {
    try {
      const { Client } = await import('@gradio/client');
      const { fromBuffer } = await import('pdf2pic');

      const convert = fromBuffer(buffer, {
        density: 300,
        saveFilename: 'deepseek_ocr',
        savePath: '/tmp',
        format: 'png',
        width: 2550,
        height: 3300
      });

      const allText = [];
      const maxPages = 3;

      const client = await Client.connect("prithiVLmods/DeepSeek-OCR-2-Unlimited-OCR", {
        hf_token: hfKey
      });

      for (let page = 1; page <= maxPages; page++) {
        try {
          const imgResult = await convert(page, { responseType: 'base64' });
          if (!imgResult?.base64) break;

          const imgBuffer = Buffer.from(imgResult.base64, 'base64');
          const blob = new Blob([imgBuffer], { type: 'image/png' });

          const result = await client.predict("/run", {
            image: blob,
          });

          const pageText = (result?.data?.[0] || result?.data || '').toString().trim();
          if (pageText.length > 20) {
            allText.push(pageText);
          }
        } catch (pageErr) {
          if (page === 1) throw pageErr;
          break;
        }
      }

      const combinedText = allText.join('\n\n').trim();
      if (combinedText.length >= 50) {
        console.log(`[Get My Job] ✓ DeepSeek-OCR-2 extracted ${combinedText.length} chars from ${allText.length} pages`);
        return { text: combinedText, method: 'deepseek-ocr', chars: combinedText.length };
      }
      errors.push(`deepseek-ocr returned only ${combinedText.length} chars`);
    } catch (err) {
      console.log('[Get My Job] DeepSeek-OCR-2 unavailable, falling back:', err.message);
      errors.push(`deepseek-ocr failed: ${err.message}`);
    }
  }

  // ── Method 1: pdf-parse (high quality, handles 95%+ of text-based PDFs) ──
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    
    async function customRender(pageData) {
      let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
      const textContent = await pageData.getTextContent(render_options);
      let lastY, pageText = '';
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY) {
          pageText += item.str;
        } else {
          pageText += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      try {
        const annotations = await pageData.getAnnotations();
        const links = annotations.filter(a => a.subtype === 'Link' && a.url);
        if (links.length > 0) {
          pageText += '\n\n[Embedded Links from this page]:\n';
          links.forEach(l => { pageText += `- ${l.url}\n`; });
        }
      } catch (e) {}
    
      return pageText;
    }

    const data = await pdfParse(buffer, { max: 50, pagerender: customRender });
    const text = (data.text || '').trim();
    if (text.length >= 50) {
      return { text, method: 'pdf-parse', chars: text.length };
    }
    errors.push(`pdf-parse returned only ${text.length} chars`);
  } catch (err) {
    console.log("pdf-parse failed:", err); errors.push(`pdf-parse failed: ${err.message}`);
  }

  // ── Method 1.5: OCR Fallback (for scanned/image-based PDFs) ──
  const ocrApiKey = process.env.OCR_SPACE_API_KEY;
  if (ocrApiKey && ocrApiKey !== 'your-ocr-space-api-key') {
    try {
      const base64Pdf = `data:application/pdf;base64,${buffer.toString('base64')}`;
      const form = new FormData();
      form.append('base64Image', base64Pdf);
      form.append('language', 'eng');
      form.append('isOverlayRequired', 'false');
      form.append('OCREngine', '2');

      const ocrRes = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': ocrApiKey,
        },
        body: form
      });

      const ocrData = await ocrRes.json();
      if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults?.length > 0) {
        const text = ocrData.ParsedResults.map(r => r.ParsedText).join('\n').trim();
        if (text.length >= 50) {
          return { text, method: 'ocr-api', chars: text.length };
        }
        errors.push(`ocr-api returned only ${text.length} chars`);
      } else {
        errors.push(`ocr-api failed: ${ocrData.ErrorMessage || 'Unknown error'}`);
      }
    } catch (err) {
      errors.push(`ocr-api fetch failed: ${err.message}`);
    }
  }

  // ── Method 1.75: Google Cloud Vision OCR (high-accuracy, 1000 free/month) ──
  const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
  if (visionApiKey) {
    try {
      const base64Content = buffer.toString('base64');
      const visionPayload = {
        requests: [{
          image: { content: base64Content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
        }]
      };

      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visionPayload)
        }
      );

      const visionData = await visionRes.json();
      const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text?.trim();
      if (fullText && fullText.length >= 50) {
        return { text: fullText, method: 'google-vision', chars: fullText.length };
      }
      errors.push(`google-vision returned only ${(fullText || '').length} chars`);
    } catch (err) {
      errors.push(`google-vision failed: ${err.message}`);
    }
  }

  // ── Method 1.9: Tesseract.js LOCAL OCR (100% free, unlimited, offline) ──
  try {
    const { fromBuffer } = await import('pdf2pic');
    const Tesseract = (await import('tesseract.js')).default;

    // Convert first 3 pages of PDF to images
    const os = await import('os');
    const convert = fromBuffer(buffer, {
      density: 300,
      saveFilename: 'ocr_page',
      savePath: os.tmpdir(),
      format: 'png',
      width: 2550,
      height: 3300
    });

    const allText = [];
    const maxPages = 3; // OCR first 3 pages for speed

    for (let page = 1; page <= maxPages; page++) {
      try {
        const result = await convert(page, { responseType: 'base64' });
        if (result?.base64) {
          const { data: { text: pageText } } = await Tesseract.recognize(
            `data:image/png;base64,${result.base64}`,
            'eng',
            { logger: () => {} } // suppress progress logs
          );
          if (pageText?.trim()) {
            allText.push(pageText.trim());
          }
        }
      } catch (pageErr) {
        // Page doesn't exist or conversion failed — stop trying more pages
        break;
      }
    }

    const combinedText = allText.join('\n\n').trim();
    if (combinedText.length >= 50) {
      return { text: combinedText, method: 'tesseract-local', chars: combinedText.length };
    }
    errors.push(`tesseract-local returned only ${combinedText.length} chars`);
  } catch (err) {
    errors.push(`tesseract-local failed: ${err.message}`);
  }

  // ── Method 2: Regex fallback (for edge-case PDFs) ──
  try {
    const text = extractTextFromPDFRegex(buffer);
    if (text.length >= 50) {
      return { text, method: 'regex-fallback', chars: text.length };
    }
    errors.push(`regex fallback returned only ${text.length} chars`);
  } catch (err) {
    errors.push(`regex fallback failed: ${err.message}`);
  }

  // ── Method 3: Raw printable text extraction ──
  try {
    const rawText = buffer.toString('utf-8')
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\u024F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (rawText.length >= 50) {
      return { text: rawText, method: 'raw-text', chars: rawText.length };
    }
    errors.push(`raw text returned only ${rawText.length} chars`);
  } catch (err) {
    errors.push(`raw text failed: ${err.message}`);
  }

  throw new Error(
    `Could not extract enough text from PDF. The PDF may be scanned/image-based. ` +
    `Please copy-paste the resume text using the "Paste LaTeX" option instead. ` +
    `Details: ${errors.join('; ')}`
  );
}

/**
 * Regex-based PDF text extraction (fallback).
 */
function extractTextFromPDFRegex(buffer) {
  const text = buffer.toString('latin1');
  const extractedParts = [];

  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    
    const parenRegex = /\(([^)]*)\)/g;
    let pMatch;
    while ((pMatch = parenRegex.exec(block)) !== null) {
      const decoded = pMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      if (decoded.trim()) extractedParts.push(decoded);
    }

    const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
    let hMatch;
    while ((hMatch = hexRegex.exec(block)) !== null) {
      const hex = hMatch[1].replace(/\s/g, '');
      let decoded = '';
      for (let i = 0; i < hex.length - 1; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode < 127) {
          decoded += String.fromCharCode(charCode);
        }
      }
      if (decoded.trim()) extractedParts.push(decoded);
    }
  }

  return extractedParts.join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s([.,;:!?])/g, '$1')
    .trim();
}

// ═══════════════════════════════════════════════════════════
// 2. TEXT EXTRACTION — DOCX
// ═══════════════════════════════════════════════════════════

/**
 * Extract text from a DOCX buffer using mammoth.
 */
export async function extractTextFromDOCX(buffer) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || '').trim();
  
  if (text.length < 50) {
    throw new Error(
      `DOCX extraction returned only ${text.length} characters. ` +
      `The file may be empty or corrupted.`
    );
  }
  
  return { text, method: 'mammoth', chars: text.length };
}

// ═══════════════════════════════════════════════════════════
// 3. TEXT EXTRACTION & ATS VALIDATION — LaTeX
// ═══════════════════════════════════════════════════════════

/**
 * Validates LaTeX source against ATS parsing best practices.
 */
export function analyzeLatexAtsCompliance(latex) {
  const warnings = [];
  const textLower = latex.toLowerCase();

  // 1. Font Size Check (ATS often ignores text < 10pt)
  const fontMatch = latex.match(/\\documentclass\[([^\]]*)\]\{/);
  if (fontMatch) {
    const opts = fontMatch[1].toLowerCase();
    if (opts.includes('8pt') || opts.includes('9pt')) {
      warnings.push('Warning: Font size is under 10pt. ATS systems often struggle to parse or penalize micro-fonts.');
    }
  }

  // 2. Margin Check (0.5+ inch required)
  const geomMatch = latex.match(/\\usepackage\[([^\]]*)\]\{geometry\}/);
  if (geomMatch) {
    const geomOpts = geomMatch[1].toLowerCase();
    // Look for things like margin=0.3in, left=0.4in
    const tinyMargins = geomOpts.match(/(?:margin|left|right|top|bottom)\s*=\s*(0\.[1-4][0-9]*|0)(?:in|cm)/g);
    if (tinyMargins) {
      warnings.push('Warning: Margins appear to be less than 0.5 inches. This can cause rendering/parsing cutoff in older ATS systems.');
    }
  }

  // 3. Hidden Text Padding (white-font padding)
  if (textLower.includes('\\color{white}') || textLower.includes('\\textcolor{white}')) {
    warnings.push('CRITICAL: White/invisible text detected. ATS systems flag this as resume spamming/keyword stuffing and may auto-reject.');
  }

  // 4. Two-Column Layout (ATS parsing issue)
  if (textLower.includes('twocolumn') || textLower.includes('\\begin{multicols}')) {
    warnings.push('Warning: Multi-column layouts can break reading order in older ATS systems. Single-column is highly recommended.');
  }

  return {
    is_compliant: warnings.length === 0,
    warnings
  };
}

/**
 * Strip LaTeX commands and leave clean plaintext for better parsing.
 */
export function stripLatexCommands(latex) {
  let text = latex;

  // Remove comments
  text = text.replace(/%.*$/gm, '');
  
  // Remove document preamble (everything before \begin{document})
  const beginDoc = text.indexOf('\\begin{document}');
  if (beginDoc !== -1) {
    text = text.substring(beginDoc + '\\begin{document}'.length);
  }
  text = text.replace(/\\end\{document\}/g, '');

  // Extract href URLs: \href{URL}{text} → text (URL)
  text = text.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)');
  
  // Extract \textbf{}, \textit{}, etc → content
  text = text.replace(/\\(?:textbf|textit|underline|emph|textsc|textrm|textsf|texttt)\{([^}]*)\}/g, '$1');
  
  // Handle \section, \subsection etc → content with newline
  text = text.replace(/\\(?:section|subsection|subsubsection)\*?\{([^}]*)\}/g, '\n$1\n');
  
  // Handle itemize/enumerate environments
  text = text.replace(/\\begin\{(?:itemize|enumerate|description)\}/g, '');
  text = text.replace(/\\end\{(?:itemize|enumerate|description)\}/g, '');
  text = text.replace(/\\item\s*/g, '• ');
  
  // Remove environments
  text = text.replace(/\\(?:begin|end)\{[^}]*\}/g, '');
  
  // Remove common commands with arguments
  text = text.replace(/\\(?:vspace|hspace|vfill|hfill|newpage|clearpage|pagebreak|noindent|centering|raggedright|raggedleft)\*?\{?[^}]*\}?/g, '');
  text = text.replace(/\\(?:setlength|addtolength|setcounter)\{[^}]*\}\{[^}]*\}/g, '');
  
  // Remove font size commands
  text = text.replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, '');
  
  // Remove spacing/formatting
  text = text.replace(/\\(?:hline|cline\{[^}]*\}|\\)/g, '\n');
  text = text.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
  text = text.replace(/\\[a-zA-Z]+/g, '');
  
  // Remove backslash escapes for special characters
  text = text.replace(/\\([&%$#_{}~^\\])/g, '$1');
  
  // Clean up braces and special chars
  text = text.replace(/[{}]/g, '');
  text = text.replace(/~/, ' ');
  text = text.replace(/\\\\/g, '\n');
  text = text.replace(/\\&/g, '&');
  text = text.replace(/\\%/g, '%');
  text = text.replace(/\\\$/g, '$');
  text = text.replace(/\\#/g, '#');
  
  // Clean whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
}

// ═══════════════════════════════════════════════════════════
// 4. LOCAL STRUCTURED EXTRACTION (Zero-API, Unlimited)
// ═══════════════════════════════════════════════════════════

/**
 * Comprehensive skills dictionary for keyword matching.
 * Organized by category for better detection.
 */
const SKILLS_DICTIONARY = {
  languages: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'c', 'go', 'golang',
    'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl',
    'haskell', 'elixir', 'dart', 'lua', 'objective-c', 'assembly', 'fortran',
    'cobol', 'groovy', 'clojure', 'erlang', 'julia', 'ocaml', 'zig', 'nim',
    'solidity', 'vhdl', 'verilog', 'sql', 'plsql', 'pl/sql', 'bash', 'powershell',
    'shell', 'zsh', 'fish',
  ],
  frontend: [
    'react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'angular', 'angularjs',
    'vue', 'vue.js', 'vuejs', 'svelte', 'sveltekit', 'nuxt', 'nuxt.js', 'gatsby',
    'remix', 'astro', 'solid.js', 'solidjs', 'qwik', 'lit', 'preact', 'alpine.js',
    'htmx', 'ember', 'ember.js', 'backbone', 'backbone.js', 'jquery', 'html', 'html5',
    'css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss', 'bootstrap',
    'material ui', 'material-ui', 'mui', 'chakra ui', 'ant design', 'antd',
    'styled-components', 'emotion', 'radix', 'shadcn', 'framer motion', 'three.js',
    'threejs', 'd3', 'd3.js', 'chart.js', 'recharts', 'storybook', 'webpack',
    'vite', 'rollup', 'parcel', 'esbuild', 'turbopack', 'babel',
  ],
  backend: [
    'node', 'node.js', 'nodejs', 'express', 'express.js', 'expressjs', 'fastify',
    'nestjs', 'nest.js', 'koa', 'hapi', 'django', 'flask', 'fastapi', 'spring',
    'spring boot', 'springboot', 'rails', 'ruby on rails', 'laravel', 'symfony',
    'asp.net', '.net', 'dotnet', '.net core', 'gin', 'fiber', 'echo',
    'phoenix', 'actix', 'rocket', 'axum', 'graphql', 'rest', 'restful',
    'grpc', 'soap', 'websocket', 'websockets', 'socket.io', 'trpc',
  ],
  databases: [
    'postgresql', 'postgres', 'mysql', 'mariadb', 'sqlite', 'oracle', 'sql server',
    'mssql', 'mongodb', 'mongoose', 'redis', 'memcached', 'elasticsearch', 'opensearch',
    'cassandra', 'dynamodb', 'firestore', 'firebase', 'supabase', 'cockroachdb',
    'neo4j', 'arangodb', 'couchdb', 'couchbase', 'influxdb', 'timescaledb',
    'clickhouse', 'snowflake', 'bigquery', 'redshift', 'databricks', 'prisma',
    'typeorm', 'sequelize', 'knex', 'drizzle', 'sqlalchemy', 'hibernate',
  ],
  devops: [
    'docker', 'kubernetes', 'k8s', 'helm', 'terraform', 'ansible', 'puppet',
    'chef', 'vagrant', 'packer', 'consul', 'vault', 'nomad', 'istio', 'envoy',
    'nginx', 'apache', 'caddy', 'traefik', 'haproxy', 'jenkins', 'github actions',
    'gitlab ci', 'circle ci', 'circleci', 'travis ci', 'argo cd', 'argocd',
    'spinnaker', 'tekton', 'drone', 'prometheus', 'grafana', 'datadog', 'new relic',
    'splunk', 'elk', 'logstash', 'kibana', 'fluentd', 'jaeger', 'opentelemetry',
  ],
  cloud: [
    'aws', 'amazon web services', 'ec2', 's3', 'lambda', 'ecs', 'eks', 'fargate',
    'rds', 'sqs', 'sns', 'cloudfront', 'route53', 'iam', 'vpc', 'cloudwatch',
    'gcp', 'google cloud', 'cloud run', 'cloud functions', 'app engine', 'gke',
    'azure', 'azure devops', 'azure functions', 'cosmos db', 'blob storage',
    'vercel', 'netlify', 'heroku', 'digitalocean', 'linode', 'fly.io', 'railway',
    'render', 'cloudflare', 'cloudflare workers',
  ],
  mobile: [
    'react native', 'flutter', 'ionic', 'capacitor', 'cordova', 'xamarin',
    'maui', 'swiftui', 'uikit', 'jetpack compose', 'android', 'ios',
    'expo', 'nativescript', 'pwa',
  ],
  ai_ml: [
    'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml',
    'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy',
    'scipy', 'matplotlib', 'seaborn', 'plotly', 'jupyter', 'hugging face',
    'huggingface', 'transformers', 'langchain', 'llamaindex', 'openai', 'gpt',
    'bert', 'llm', 'nlp', 'natural language processing', 'computer vision',
    'opencv', 'yolo', 'stable diffusion', 'generative ai', 'rag',
    'neural network', 'cnn', 'rnn', 'lstm', 'gan', 'reinforcement learning',
    'xgboost', 'lightgbm', 'catboost', 'mlops', 'mlflow', 'kubeflow',
    'sagemaker', 'vertex ai',
  ],
  testing: [
    'jest', 'mocha', 'chai', 'jasmine', 'vitest', 'cypress', 'playwright',
    'selenium', 'puppeteer', 'testing library', 'react testing library', 'rtl',
    'enzyme', 'supertest', 'pytest', 'unittest', 'junit', 'testng', 'rspec',
    'minitest', 'go test', 'k6', 'jmeter', 'gatling', 'locust', 'artillery',
    'tdd', 'bdd', 'e2e', 'unit testing', 'integration testing',
  ],
  tools: [
    'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial',
    'jira', 'confluence', 'trello', 'asana', 'notion', 'linear', 'clickup',
    'slack', 'discord', 'teams', 'figma', 'sketch', 'adobe xd', 'invision',
    'postman', 'insomnia', 'swagger', 'linux', 'unix', 'macos', 'windows',
    'vim', 'neovim', 'emacs', 'vs code', 'vscode', 'intellij', 'webstorm',
    'pycharm', 'xcode', 'android studio', 'eclipse',
  ],
  methodologies: [
    'agile', 'scrum', 'kanban', 'lean', 'waterfall', 'devops', 'ci/cd',
    'ci cd', 'continuous integration', 'continuous deployment', 'continuous delivery',
    'microservices', 'monolith', 'serverless', 'event-driven', 'domain-driven design',
    'ddd', 'clean architecture', 'hexagonal architecture', 'solid', 'dry', 'kiss',
    'rest api', 'design patterns', 'oop', 'functional programming', 'fp',
    'pair programming', 'code review', 'a/b testing',
  ],
  data: [
    'apache kafka', 'kafka', 'rabbitmq', 'activemq', 'celery', 'airflow',
    'spark', 'apache spark', 'hadoop', 'hive', 'pig', 'flink', 'storm',
    'etl', 'elt', 'data pipeline', 'data engineering', 'data science',
    'data analysis', 'data visualization', 'power bi', 'tableau', 'looker',
    'dbt', 'fivetran', 'airbyte', 'data warehouse', 'data lake', 'data mesh',
  ],
  security: [
    'oauth', 'oauth2', 'jwt', 'saml', 'openid', 'sso', 'ldap', 'kerberos',
    'encryption', 'ssl', 'tls', 'https', 'cors', 'csrf', 'xss', 'sql injection',
    'penetration testing', 'owasp', 'security audit', 'vulnerability assessment',
    'cybersecurity', 'infosec', 'soc', 'siem', 'firewall', 'waf', 'zero trust',
  ],
};

// Flatten skills dictionary into a searchable set
const ALL_SKILLS = new Map();
for (const [category, skills] of Object.entries(SKILLS_DICTIONARY)) {
  for (const skill of skills) {
    ALL_SKILLS.set(skill.toLowerCase(), { name: skill, category });
  }
}

/**
 * Section heading patterns to detect resume structure.
 */
const SECTION_PATTERNS = {
  experience: /^(?:(?:work\s*)?experience|employment(?:\s*history)?|professional\s*(?:experience|background|history)|career\s*(?:history|summary)|work\s*history)\s*$/i,
  education: /^(?:education(?:al\s*background)?|academic(?:\s*background)?|qualifications|academic\s*credentials|degrees?)\s*$/i,
  skills: /^(?:(?:technical\s*)?skills|technologies|tech\s*stack|competencies|expertise|proficiency|tools?\s*(?:&|and)\s*technologies)\s*$/i,
  projects: /^(?:projects|personal\s*projects|(?:key|selected|notable)\s*projects|portfolio|side\s*projects)\s*$/i,
  certifications: /^(?:certifications?|licenses?(?:\s*&\s*certifications?)?|accreditations?|credentials?)\s*$/i,
  summary: /^(?:(?:professional\s*)?summary|(?:career\s*)?objective|about(?:\s*me)?|profile|overview|introduction)\s*$/i,
  awards: /^(?:awards?|honors?|achievements?|recognition)\s*$/i,
  publications: /^(?:publications?|papers?|research)\s*$/i,
  languages: /^(?:languages?)\s*$/i,
  interests: /^(?:interests?|hobbies|activities|extracurricular)\s*$/i,
};

/**
 * Parse resume text into structured sections.
 */
function splitIntoSections(text) {
  const lines = text.split('\n');
  const sections = {};
  let currentSection = 'header';
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentContent.push('');
      continue;
    }

    // Detect section headings (short lines, often uppercase or title case)
    let matchedSection = null;
    for (const [sectionName, pattern] of Object.entries(SECTION_PATTERNS)) {
      // Clean the line of common decorators before matching
      const cleanLine = trimmed.replace(/^[•\-*#=_|:▸▪►]+\s*/, '').replace(/\s*[•\-*#=_|:▸▪►]+$/, '').replace(/^#+\s*/, '');
      if (pattern.test(cleanLine)) {
        matchedSection = sectionName;
        break;
      }
    }

    if (matchedSection) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = (sections[currentSection] || '') + '\n' + currentContent.join('\n');
      }
      currentSection = matchedSection;
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections[currentSection] = (sections[currentSection] || '') + '\n' + currentContent.join('\n');
  }

  return sections;
}

/**
 * Extract contact information using regex patterns.
 */
function extractContact(text) {
  const contact = {
    email: null,
    phone: null,
    linkedin: null,
    github: null,
    portfolio: null,
    location: null,
  };

  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) contact.email = emailMatch[0].toLowerCase();

  // Phone (international formats)
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}/);
  if (phoneMatch) {
    const cleaned = phoneMatch[0].replace(/[^\d+()-\s]/g, '').trim();
    if (cleaned.replace(/\D/g, '').length >= 10) {
      contact.phone = cleaned;
    }
  }

  // LinkedIn
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in\/)?[\w-]+\/?/i);
  if (linkedinMatch) {
    let url = linkedinMatch[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    contact.linkedin = url;
  }

  // GitHub
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?[\w-]*/i);
  if (githubMatch) {
    let url = githubMatch[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    contact.github = url;
  }

  // Portfolio / Website (generic URL that isn't linkedin/github)
  const urlMatches = text.match(/\b(?:https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}(?:\/[^\s,)}\]>]*)?|(?<!@)\b[\w.-]+\.(?:com|io|dev|me|net|org|app|site)\b(?:\/[^\s,)}\]>]*)?/gi) || [];
  for (const url of urlMatches) {
    const lowerUrl = url.toLowerCase();
    if (!lowerUrl.includes('linkedin.com') && !lowerUrl.includes('github.com') && !lowerUrl.includes('google.com')) {
      let finalUrl = url;
      if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
      contact.portfolio = finalUrl;
      break;
    }
  }

  // Location — look for common patterns like "City, State" or "City, Country"
  // Limit search to the top of the resume (first 500 chars) to avoid false positives
  const headerText = text.slice(0, 500);
  const locationPatterns = [
    /(?:location|address|based in|residing in)\s*[:–-]?\s*(.+)/i,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2}(?:\s\d{5})?)/,  // "City, ST" or "City, ST 12345"
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*(?:United States|UK|Canada|India|Australia|Germany|France|Spain|Italy|Brazil|Mexico|Japan|China))/i,
  ];
  for (const pattern of locationPatterns) {
    const match = headerText.match(pattern);
    if (match) {
      const loc = (match[1] || match[0]).trim();
      // Filter out false positives (section headings, skills, etc.)
      if (loc.length > 3 && loc.length < 80 && !loc.match(/^(experience|education|skills|projects)/i)) {
        contact.location = loc;
        break;
      }
    }
  }

  return contact;
}

/**
 * Extract the person's name from the header section of the resume.
 */
function extractName(headerText) {
  if (!headerText) return { first_name: null, last_name: null };
  
  const lines = headerText.trim().split('\n').filter(l => l.trim());
  
  // The name is typically on the first or second non-empty line
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i].trim()
      .replace(/^[•\-*#=_|:▸▪►]+\s*/, '')
      .replace(/\s*[|•\-].*$/, ''); // Remove "Name | Title" suffixes
    
    // Skip if it looks like an email, phone, URL, or is too long
    if (line.match(/[@()\d]{3,}/) || line.includes('http') || line.length > 50) continue;
    // Skip if it looks like a section heading
    if (Object.values(SECTION_PATTERNS).some(p => p.test(line))) continue;
    
    // Check if it looks like a name (2-4 words, mostly alpha)
    const words = line.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2 && words.length <= 5) {
      const alphaWords = words.filter(w => /^[A-Za-z.''-]+$/.test(w));
      if (alphaWords.length >= 2) {
        return {
          first_name: alphaWords[0],
          last_name: alphaWords.slice(1).join(' '),
        };
      }
    }
    
    // Single name on a line (less common but possible)
    if (words.length === 1 && /^[A-Z][a-z]+$/.test(words[0]) && i === 0) {
      // Check next line for last name
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextWords = nextLine.split(/\s+/);
        if (nextWords.length === 1 && /^[A-Z][a-z]+$/.test(nextWords[0])) {
          return { first_name: words[0], last_name: nextWords[0] };
        }
      }
    }
  }
  
  return { first_name: null, last_name: null };
}

/**
 * Extract a professional title/headline from the header.
 */
function extractTitle(headerText) {
  if (!headerText) return null;
  
  const titlePatterns = [
    /(?:senior|sr\.?|junior|jr\.?|lead|principal|staff|chief|head)\s+(?:\w+\s+){0,2}(?:engineer|developer|architect|designer|manager|analyst|scientist|consultant)/i,
    /(?:full[\s-]?stack|front[\s-]?end|back[\s-]?end|mobile|devops|cloud|data|ml|ai|software|web)\s+(?:engineer|developer|architect)/i,
    /(?:software|web|mobile|application|platform)\s+(?:engineer|developer|architect)/i,
    /(?:product|project|program|engineering)\s+manager/i,
    /(?:data|business|systems?)\s+(?:analyst|scientist|engineer)/i,
    /(?:ux|ui|ux\/ui|product)\s+designer/i,
    /(?:technical|solution|enterprise)\s+architect/i,
    /(?:devops|sre|site reliability|platform|infrastructure)\s+engineer/i,
    /(?:machine learning|ml|ai|nlp|deep learning)\s+engineer/i,
    /(?:qa|quality assurance|test|sdet)\s+(?:engineer|analyst|lead)/i,
    /(?:cto|ceo|coo|cfo|vp|director|head)\s+(?:of\s+)?(?:engineering|technology|product|design)/i,
  ];
  
  const lines = headerText.split('\n').slice(0, 8);
  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of titlePatterns) {
      const match = trimmed.match(pattern);
      if (match) return match[0];
    }
  }
  
  return null;
}

/**
 * Extract skills using comprehensive dictionary matching.
 */
function extractSkills(text, skillsSectionText) {
  const found = new Set();
  const searchText = (text + ' ' + (skillsSectionText || '')).toLowerCase();
  
  // Word boundary-aware matching
  for (const [skillLower, info] of ALL_SKILLS.entries()) {
    // For very short skills (1-2 chars like "c", "r"), require word boundaries
    if (skillLower.length <= 2) {
      const regex = new RegExp(`\\b${escapeRegex(skillLower)}\\b`, 'i');
      if (regex.test(searchText)) {
        // Extra check: for single-letter skills, make sure they're used as tech terms
        if (skillLower === 'c' && !searchText.match(/\bc\s*(?:programming|language|\+\+|#)/i)) continue;
        if (skillLower === 'r' && !searchText.match(/\br\s*(?:programming|language|studio)/i)) continue;
        found.add(formatSkillName(info.name));
      }
    } else {
      // For longer skills, use a simpler check with word boundaries
      const regex = new RegExp(`\\b${escapeRegex(skillLower)}\\b`, 'i');
      if (regex.test(searchText)) {
        found.add(formatSkillName(info.name));
      }
    }
  }
  
  return [...found];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSkillName(name) {
  // Preserve known casing
  const casings = {
    'javascript': 'JavaScript', 'typescript': 'TypeScript', 'reactjs': 'React.js',
    'react.js': 'React.js', 'react': 'React', 'nodejs': 'Node.js', 'node.js': 'Node.js',
    'node': 'Node.js', 'nextjs': 'Next.js', 'next.js': 'Next.js', 'vuejs': 'Vue.js',
    'vue.js': 'Vue.js', 'vue': 'Vue.js', 'angularjs': 'Angular', 'angular': 'Angular',
    'expressjs': 'Express.js', 'express.js': 'Express.js', 'express': 'Express',
    'mongodb': 'MongoDB', 'postgresql': 'PostgreSQL', 'postgres': 'PostgreSQL',
    'mysql': 'MySQL', 'graphql': 'GraphQL', 'html': 'HTML', 'html5': 'HTML5',
    'css': 'CSS', 'css3': 'CSS3', 'sass': 'Sass', 'scss': 'SCSS', 'aws': 'AWS',
    'gcp': 'GCP', 'docker': 'Docker', 'kubernetes': 'Kubernetes', 'k8s': 'Kubernetes',
    'redis': 'Redis', 'elasticsearch': 'Elasticsearch', 'python': 'Python',
    'java': 'Java', 'golang': 'Go', 'go': 'Go', 'rust': 'Rust', 'ruby': 'Ruby',
    'php': 'PHP', 'swift': 'Swift', 'kotlin': 'Kotlin', 'dart': 'Dart',
    'c++': 'C++', 'c#': 'C#', 'sql': 'SQL', 'nosql': 'NoSQL', 'git': 'Git',
    'github': 'GitHub', 'gitlab': 'GitLab', 'tailwindcss': 'Tailwind CSS',
    'tailwind': 'Tailwind CSS', 'bootstrap': 'Bootstrap', 'figma': 'Figma',
    'flutter': 'Flutter', 'react native': 'React Native', 'tensorflow': 'TensorFlow',
    'pytorch': 'PyTorch', 'django': 'Django', 'flask': 'Flask', 'fastapi': 'FastAPI',
    'nestjs': 'NestJS', 'nest.js': 'NestJS', 'spring': 'Spring', 'spring boot': 'Spring Boot',
    'firebase': 'Firebase', 'supabase': 'Supabase', 'prisma': 'Prisma',
    'jenkins': 'Jenkins', 'terraform': 'Terraform', 'ansible': 'Ansible',
    'nginx': 'Nginx', 'linux': 'Linux', 'bash': 'Bash', 'powershell': 'PowerShell',
    'jest': 'Jest', 'cypress': 'Cypress', 'playwright': 'Playwright',
    'webpack': 'Webpack', 'vite': 'Vite', 'babel': 'Babel',
  };
  return casings[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Parse experience entries from the experience section text.
 */
function parseExperience(sectionText) {
  if (!sectionText) return [];
  
  const entries = [];
  const lines = sectionText.trim().split('\n').filter(l => l.trim());
  
  let current = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Detect a new entry: usually has a company name and/or date
    const dateMatch = trimmed.match(
      /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4}|(?:19|20)\d{2})\s*[-–—to]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4}|(?:19|20)\d{2}|present|current|now|ongoing)/i
    );
    
    const isBullet = /^[•\-*▸▪►]\s/.test(trimmed);
    
    // Check if this looks like a role/company line (has date or title pattern)
    const hasTitle = /(?:engineer|developer|manager|analyst|designer|architect|intern|lead|senior|junior|director|vp|head|consultant|specialist|coordinator|associate|executive)/i.test(trimmed);
    
    if ((dateMatch || (hasTitle && !isBullet)) && !isBullet) {
      // Save previous entry
      if (current) entries.push(current);
      
      // Parse the new entry
      let role = '';
      let company = '';
      let startDate = '';
      let endDate = '';
      
      // Extract dates
      if (dateMatch) {
        const dateParts = dateMatch[0].split(/\s*[-–—]\s*|\s*to\s*/i);
        startDate = dateParts[0]?.trim() || '';
        endDate = dateParts[1]?.trim() || '';
      }
      
      // The remaining text (without dates) is the role/company
      let roleCompanyText = trimmed.replace(dateMatch ? dateMatch[0] : '', '').trim();
      roleCompanyText = roleCompanyText.replace(/[|,–—-]\s*$/, '').replace(/^\s*[|,–—-]/, '').trim();
      
      // Try to split "Role at Company" or "Role | Company" or "Role, Company"
      const splitPatterns = [
        /^(.+?)\s+at\s+(.+)$/i,
        /^(.+?)\s*[|]\s*(.+)$/,
        /^(.+?)\s*[-–—]\s*(.+)$/,
        /^(.+?),\s*(.+)$/,
      ];
      
      let matched = false;
      for (const pattern of splitPatterns) {
        const m = roleCompanyText.match(pattern);
        if (m) {
          role = m[1].trim();
          company = m[2].trim();
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        role = roleCompanyText;
      }
      
      current = {
        title: role || null,
        company: company || null,
        location: null,
        tenure: (startDate && endDate) ? `${startDate} - ${endDate}` : (startDate || endDate || null),
        description: '',
        bullets: [],
      };
    } else if (current) {
      // This is a bullet point or description line for the current entry
      if (isBullet) {
        current.bullets.push(trimmed.replace(/^[•\-*▸▪►]\s*/, ''));
      } else {
        // Could be a company name on a separate line, or continuation
        if (!current.company && !dateMatch && !isBullet && trimmed.length < 80) {
          current.company = trimmed;
        } else {
          current.description += (current.description ? ' ' : '') + trimmed;
        }
      }
    }
  }
  
  // Save last entry
  if (current) entries.push(current);
  
  // Build description from bullets
  for (const entry of entries) {
    if (entry.bullets.length > 0 && !entry.description) {
      entry.description = entry.bullets.join('. ');
    }
    delete entry.bullets;
  }
  
  return entries;
}

/**
 * Parse education entries from the education section text.
 */
function parseEducation(sectionText) {
  if (!sectionText) return [];
  
  const entries = [];
  const lines = sectionText.trim().split('\n').filter(l => l.trim());
  
  const degreePatterns = /(?:b\.?s\.?c?\.?|m\.?s\.?c?\.?|b\.?a\.?|m\.?a\.?|b\.?e\.?|m\.?e\.?|b\.?tech|m\.?tech|ph\.?d\.?|mba|diploma|bachelor|master|doctor|associate|certificate|certification)/i;
  
  let current = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const hasDegree = degreePatterns.test(trimmed);
    const hasYear = /(?:19|20)\d{2}/.test(trimmed);
    const isBullet = /^[•\-*▸▪►]\s/.test(trimmed);
    
    if ((hasDegree || (hasYear && !isBullet)) && !isBullet) {
      if (current) entries.push(current);
      
      // Extract year/date range
      const yearMatch = trimmed.match(/(?:((?:19|20)\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|present|current|expected\s*(?:19|20)\d{2}))|((?:19|20)\d{2})/i);
      
      let degree = trimmed;
      let institution = '';
      let year = '';
      
      if (yearMatch) {
        year = yearMatch[0];
        degree = trimmed.replace(yearMatch[0], '').trim();
      }
      
      // Try to split degree and institution
      const splitMatch = degree.match(/^(.+?)\s*[-–—|,]\s*(.+)$/) || degree.match(/^(.+?)\s+(?:from|at)\s+(.+)$/i);
      if (splitMatch) {
        degree = splitMatch[1].trim();
        institution = splitMatch[2].trim();
      }
      
      current = {
        degree: degree.replace(/[|,–—-]\s*$/, '').trim() || null,
        major: null,
        institution: institution || null,
        graduationYear: year || null,
        marks: null,
        details: '',
      };
      
      // Extract GPA
      const gpaMatch = trimmed.match(/(?:gpa|cgpa|grade|score)\s*[:=]?\s*(\d\.?\d*(?:\/\d+)?)/i) ||
                        trimmed.match(/(\d\.\d+)\s*(?:\/\s*\d+)?\s*(?:gpa|cgpa)/i);
      if (gpaMatch) current.marks = gpaMatch[1];
      
    } else if (current) {
      if (isBullet) {
        current.details += (current.details ? '; ' : '') + trimmed.replace(/^[•\-*▸▪►]\s*/, '');
      } else if (!current.institution && trimmed.length < 100) {
        current.institution = trimmed;
      }
    }
  }
  
  if (current) entries.push(current);
  
  return entries;
}

/**
 * Parse project entries from the projects section text.
 */
function parseProjects(sectionText) {
  if (!sectionText) return [];
  
  const entries = [];
  const lines = sectionText.trim().split('\n').filter(l => l.trim());
  
  let current = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const isBullet = /^[•\-*▸▪►]\s/.test(trimmed);
    
    // A project title is usually a short non-bullet line
    if (!isBullet && trimmed.length < 120 && (
      // Starts with uppercase or has link
      /^[A-Z]/.test(trimmed) || trimmed.includes('http') || trimmed.includes('github')
    )) {
      if (current) entries.push(current);
      
      // Split "Project Name — Description" or "Project Name | Tech Stack"
      const splitMatch = trimmed.match(/^(.+?)\s*[-–—|]\s*(.+)$/);
      
      current = {
        title: splitMatch ? splitMatch[1].trim() : trimmed,
        description: splitMatch ? splitMatch[2].trim() : '',
        technologies: '',
        link: null,
      };
      
      // Extract link
      const linkMatch = trimmed.match(/(?:https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}(?:\/[^\s,)}\]>]*)?|[\w.-]+\.(?:com|io|dev|me|net|org|app|site)\b(?:\/[^\s,)}\]>]*)?/i);
      if (linkMatch) {
        let url = linkMatch[0];
        if (!url.startsWith('http')) url = 'https://' + url;
        current.link = url;
      }
      
    } else if (current && isBullet) {
      const bulletText = trimmed.replace(/^[•\-*▸▪►]\s*/, '');
      current.description += (current.description ? '. ' : '') + bulletText;
      
      // Try to extract tech from "Technologies: ..." or "Built with ..."
      const techMatch = bulletText.match(/(?:tech(?:nolog(?:y|ies))?|built with|stack|tools?|using)\s*[:=]?\s*(.+)/i);
      if (techMatch) {
        current.technologies = techMatch[1].split(/[,;|]/).map(t => t.trim()).filter(Boolean).join(', ');
      }

      // Check for link in bullet text if we don't have one
      if (!current.link) {
        const linkMatch = bulletText.match(/(?:https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}(?:\/[^\s,)}\]>]*)?|[\w.-]+\.(?:com|io|dev|me|net|org|app|site)\b(?:\/[^\s,)}\]>]*)?/i);
        if (linkMatch) {
          let url = linkMatch[0];
          if (!url.startsWith('http')) url = 'https://' + url;
          current.link = url;
        }
      }
    } else if (current) {
      current.description += (current.description ? ' ' : '') + trimmed;
    }
  }
  
  if (current) entries.push(current);
  
  return entries;
}

/**
 * Parse certifications from the certifications section text.
 */
function parseCertifications(sectionText) {
  if (!sectionText) return [];
  
  const entries = [];
  const lines = sectionText.trim().split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[•\-*▸▪►]\s*/, '');
    if (!trimmed || trimmed.length < 3) continue;
    
    // Try to extract date from line
    const dateMatch = trimmed.match(/(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4}|(?:19|20)\d{2})/i);
    
    // Try to split "Cert Name — Issuer" or "Cert Name | Issuer" or "Cert Name, Issuer"
    let name = trimmed;
    let issuer = null;
    let date = dateMatch ? dateMatch[0] : null;
    
    // Remove date from name
    if (date) {
      name = name.replace(dateMatch[0], '').trim();
    }
    
    const splitMatch = name.match(/^(.+?)\s*[-–—|]\s*(.+)$/) || name.match(/^(.+?),\s*(.+)$/);
    if (splitMatch) {
      name = splitMatch[1].trim();
      issuer = splitMatch[2].trim();
    }
    
    // Clean trailing punctuation
    name = name.replace(/[,;|–—-]\s*$/, '').trim();
    if (issuer) issuer = issuer.replace(/[,;|–—-]\s*$/, '').trim();
    
    if (name.length > 2) {
      entries.push({ name, issuer, date });
    }
  }
  
  return entries;
}

/**
 * Extract professional summary/objective text.
 */
function parseSummary(sectionText) {
  if (!sectionText) return null;
  const text = sectionText.trim()
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text.length > 10 ? text : null;
}

/**
 * Parse awards/achievements from the awards section text.
 */
function parseAwards(sectionText) {
  if (!sectionText) return [];
  
  const entries = [];
  const lines = sectionText.trim().split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[•\-*▸▪►]\s*/, '');
    if (!trimmed || trimmed.length < 3) continue;
    
    // Try to split "Award Title — Description" or just take the whole line as title
    const splitMatch = trimmed.match(/^(.+?)\s*[-–—|]\s*(.+)$/);
    if (splitMatch) {
      entries.push({ title: splitMatch[1].trim(), description: splitMatch[2].trim() });
    } else {
      entries.push({ title: trimmed, description: null });
    }
  }
  
  return entries;
}

/**
 * Detect years of experience from the text.
 */
function detectExperienceYears(text, experience) {
  // Check for explicit mentions
  const explicitMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
  if (explicitMatch) return explicitMatch[1] + '+ years';
  
  // Calculate from experience entries
  if (experience.length > 0) {
    let totalMonths = 0;
    const now = new Date();
    
    for (const entry of experience) {
      if (entry.tenure) {
        const dates = entry.tenure.split('-');
        const start_date = dates[0] ? dates[0].trim() : '';
        const end_date = dates[1] ? dates[1].trim() : '';

        const startYear = parseInt(start_date.match(/\d{4}/)?.[0] || '0');
        let endYear = now.getFullYear();
        
        if (end_date && !/present|current|now|ongoing/i.test(end_date)) {
          endYear = parseInt(end_date.match(/\d{4}/)?.[0] || String(endYear));
        }
        
        if (startYear > 1980 && startYear <= now.getFullYear()) {
          totalMonths += (endYear - startYear) * 12;
        }
      }
    }
    
    const years = Math.round(totalMonths / 12);
    if (years > 0) return `${years}+ years`;
  }
  
  return null;
}

/**
 * Main local parsing function — replaces LLM-based extraction entirely.
 * Uses regex patterns, NLP keyword matching, and section detection.
 * 100% free, unlimited, zero API calls.
 */
export async function parseResumeWithLLM(text) {
  // Truncate text to avoid exceeding AI token limits (Groq has a strict 12K TPM limit)
  // 14,000 characters is roughly 3,500 tokens, leaving plenty of room for the prompt schema.
  const safeText = text.length > 14000 ? text.substring(0, 14000) + "\n...[TRUNCATED_DUE_TO_LENGTH]" : text;
  
  const prompt = `You are an expert resume parser. Extract the following information from the provided resume text.
  Return a valid JSON object matching this exact schema:
  {
    "first_name": "string or null",
    "last_name": "string or null",
    "title": "string or null",
    "company": "string or null",
    "summary": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin": "string or null (clean URL without https)",
    "github": "string or null (clean URL without https)",
    "portfolio": "string or null (clean URL without https)",
    "preferred_location": "string or null",
    "work_type": "string or null (e.g. Remote, Hybrid, Onsite)",
    "experience_years": "string or null (e.g. 5)",
    "notice_period": "string or null",
    "current_ctc": "string or null",
    "expected_ctc": "string or null",
    "skills": ["string", "string"],
    "languages": ["string"],
    "hobbies": ["string"],
    "experience": [
      {
        "title": "string",
        "company": "string",
        "tenure": "string",
        "location": "string",
        "description": ["string (each bullet point is a separate string)"]
      }
    ],
    "education": [
      {
        "degree": "string",
        "major": "string",
        "institution": "string",
        "startDate": "string",
        "endDate": "string",
        "marks": "string"
      }
    ],
    "projects": [
      {
        "title": "string",
        "description": ["string (each bullet point is a separate string)"],
        "link": "string",
        "technologies": "string"
      }
    ],
    "certifications": [
      {
        "name": "string",
        "issuer": "string",
        "date": "string"
      }
    ],
    "awards": [
      {
        "name": "string",
        "issuer": "string",
        "date": "string"
      }
    ]
  }

  ZERO-LOSS EXTRACTION PROTOCOL (STRICT COMPLIANCE MANDATED):
  You are a Zero-Loss Resume Extraction Engine. Your ONLY goal is 100% extraction of text and links without any summarization or fabrication.

  1. ANTI-FABRICATION: Never infer, complete, guess, or "clean up" text. You are a copier, not a writer.
  2. NO SUMMARIZATION, EVER: Never shorten, paraphrase, or tighten up a bullet, job description, or accomplishment. Extract raw text exactly as it appears, byte-for-byte.
  3. EVERY BULLET, EVERY TIME: Every bullet under an experience or project is captured individually, in source order. None are merged into a paragraph, none are dropped for being redundant. Use newline characters (\\n) to separate bullets in the 'description' array.
  4. COMPLETE SUMMARY: For the 'summary' field, extract the ENTIRE professional summary, about me, or objective exactly as written. Preserve all sentences and paragraphs.
  5. LINKS ARE SACRED (AGGRESSIVE HUNTING): Explicitly recognize domains (GitHub, LinkedIn, GitLab, Figma, Vercel, Netlify, Behance, Dribbble, App Store, Play Store, Medium, Notion, etc.). Even if a link appears as a bare domain (e.g. github.com/user), capture it.
  6. EMBEDDED LINKS MAP TO ENTRIES: Map URLs from the text (or "[Embedded Links]" sections) to the specific project, experience, or header they belong to.
  7. ORPHANED LINKS ARE NEVER DISCARDED: Any URL that cannot be mapped to a specific entry MUST be appended to the nearest containing section's description under the exact format: "\\n\\nRelated Links:\\n- URL1\\n- URL2".
  8. LATEX SOURCE SUPPORT: If the input text contains LaTeX formatting (e.g. \\href{url}{text}), extract the URL and the anchor text appropriately.
  9. EDUCATION FIELDS FULLY COMBINED: For each education entry, GPA, honors, thesis, coursework, and any other academic details MUST be captured and combined into the 'marks' or 'major' fields. None are treated as optional.
  10. TOTAL COVERAGE: Extract all certifications, publications, and awards. If there are multiple roles at the same company (promotions), capture them as separate entries if they have distinct dates and bullets.
  11. ENCODING & CHARACTER FIDELITY: Preserve non-ASCII characters, currency symbols, dashes exactly as authored.
  12. MANDATORY SELF-AUDIT: Before outputting JSON, re-scan the raw text. Ensure EVERY single URL and email address has been placed in the JSON (either in a specific field, or as a Related Link).
  13. NO MARKDOWN FORMATTING: Return ONLY the raw valid JSON string. Do NOT wrap in \`\`\`json blocks. Return empty arrays [] or null if a field is not found. Ensure the schema is strictly matched.

  Resume Text:
  ${safeText}`;

  try {
    let resultText = '';

    // Global LLM Engine v5 handles all 17-tier failover automatically
    const { callLLM: globalCallLLM } = await import('./globalLLMEngine.js');
    const completion = await globalCallLLM('parsing', {
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 8000
    });
    resultText = completion.choices[0]?.message?.content?.trim() || '{}';

    const parsedData = JSON.parse(resultText);

    // Post-process to join arrays into \n separated strings to maintain compatibility
    ['experience', 'projects'].forEach(key => {
      if (parsedData[key] && Array.isArray(parsedData[key])) {
        parsedData[key].forEach(item => {
          if (item.description && Array.isArray(item.description)) {
            item.description = item.description.join('\\n');
          }
        });
      }
    });

    console.log(
      `[Get My Job] ✓ GLOBAL_ENGINE parse complete — ` +
      `${parsedData.skills?.length || 0} skills, ` +
      `${parsedData.experience?.length || 0} experiences, ` +
      `${parsedData.education?.length || 0} education, ` +
      `${parsedData.projects?.length || 0} projects, ` +
      `${parsedData.certifications?.length || 0} certifications, ` +
      `${parsedData.awards?.length || 0} awards` +
      (parsedData.summary ? ', summary found' : '')
    );

    return cleanExtractedData(parsedData);
  } catch (error) {
    console.error("[Get My Job] AI parsing failed:", error);
    // Return empty strict schema on failure to prevent UI crashes
    return {
      first_name: null, last_name: null, title: null, company: null, summary: null,
      email: null, phone: null, location: null, linkedin: null, github: null, portfolio: null,
      preferred_location: null, work_type: null, experience_years: null, notice_period: null,
      current_ctc: null, expected_ctc: null,
      skills: [], languages: [], hobbies: [], experience: [], education: [],
      projects: [], certifications: [], awards: []
    };
  }
}


// ═══════════════════════════════════════════════════════════
// 5. DATA CLEANING & VALIDATION
// ═══════════════════════════════════════════════════════════

function normalizeLinks(data) {
  const linkFields = ['linkedin', 'portfolio', 'github'];
  for (const field of linkFields) {
    if (data[field] && typeof data[field] === 'string') {
      let url = data[field].trim();
      // Remove LaTeX artifacts
      url = url.replace(/\\href\{([^}]+)\}.*/, '$1');
      url = url.replace(/[{}\\]/g, '');
      // Add https if missing
      if (url && !url.startsWith('http')) {
        if (url.includes('linkedin.com') || url.includes('github.com')) {
          url = 'https://' + url;
        }
      }
      data[field] = url || null;
    }
  }
  return data;
}

function cleanExtractedData(data) {
  // Ensure arrays are arrays
  const arrayFields = ['skills', 'languages', 'hobbies', 'experience', 'education', 'projects', 'certifications', 'awards'];
  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) {
      data[field] = data[field] ? [data[field]] : [];
    }
  }

  // Deduplicate skills
  if (data.skills) {
    data.skills = [
      ...new Set(data.skills.map((s) => (typeof s === 'string' ? s.trim() : String(s))).filter(Boolean)),
    ];
  }

  // Clean string fields
  const stringFields = [
    'first_name', 'last_name', 'title', 'company', 'summary', 'email', 'phone', 'location',
    'preferred_location', 'work_type', 'experience_years', 'notice_period',
    'current_ctc', 'expected_ctc',
  ];
  for (const field of stringFields) {
    if (
      data[field] === null ||
      data[field] === undefined ||
      data[field] === 'null' ||
      data[field] === 'N/A'
    ) {
      data[field] = null;
    } else if (typeof data[field] === 'string') {
      // Remove LaTeX commands
      data[field] = data[field]
        .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
        .replace(/[{}\\]/g, '')
        .trim();
    }
  }

  // Normalize links
  data = normalizeLinks(data);

  return data;
}

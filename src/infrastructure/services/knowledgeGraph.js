/**
 * Knowledge Graph v3 — Get My Job Career Intelligence Graph
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * A graph-based representation of the candidate's career data that enables:
 *   - Entity extraction from brain data (projects, skills, companies, roles)
 *   - Relationship building (project→skill, company→role, skill→domain)
 *   - Traversal queries (find all projects using skill X in domain Y)
 *   - ATS pipeline integration (graph-informed project/skill selection)
 *
 * Storage: In-memory graph with JSON persistence at .data/knowledge_graph.json
 *
 * Schema v3:
 *   Nodes: { id, type, label, properties }
 *   Edges: { source, target, type, weight, properties }
 */

import fs from 'fs';
import path from 'path';

const KG_DIR = path.join(process.cwd(), '.data');
const KG_FILE = path.join(KG_DIR, 'knowledge_graph.json');

// ── Node Types ──
export const NODE_TYPES = {
  PROJECT: 'project',
  SKILL: 'skill',
  COMPANY: 'company',
  ROLE: 'role',
  DOMAIN: 'domain',
  ACHIEVEMENT: 'achievement',
  CERTIFICATION: 'certification',
  EDUCATION: 'education',
};

// ── Edge Types ──
export const EDGE_TYPES = {
  USES_SKILL: 'uses_skill',          // project → skill
  WORKED_AT: 'worked_at',            // role → company
  BELONGS_TO: 'belongs_to',          // project → domain
  HAS_ROLE: 'has_role',              // company → role
  ACHIEVED_IN: 'achieved_in',        // achievement → role
  REQUIRES_SKILL: 'requires_skill',  // domain → skill
  RELATED_TO: 'related_to',          // skill → skill
  PRODUCED_BY: 'produced_by',        // project → company
};

// ═══════════════════════════════════════════════════════════════════════════
// KnowledgeGraph Class
// ═══════════════════════════════════════════════════════════════════════════

export class KnowledgeGraph {
  constructor() {
    this.nodes = new Map();  // id → { id, type, label, properties }
    this.edges = [];         // [{ source, target, type, weight, properties }]
    this.adjacency = new Map(); // id → Set(connectedIds)
    this.version = 3;
    this.builtAt = null;
  }

  // ── Core Operations ──

  addNode(id, type, label, properties = {}) {
    if (this.nodes.has(id)) {
      // Merge properties
      const existing = this.nodes.get(id);
      existing.properties = { ...existing.properties, ...properties };
      return existing;
    }
    const node = { id, type, label, properties };
    this.nodes.set(id, node);
    if (!this.adjacency.has(id)) this.adjacency.set(id, new Set());
    return node;
  }

  addEdge(source, target, type, weight = 1.0, properties = {}) {
    // Avoid duplicate edges
    const exists = this.edges.some(e =>
      e.source === source && e.target === target && e.type === type
    );
    if (exists) return;

    this.edges.push({ source, target, type, weight, properties });
    if (!this.adjacency.has(source)) this.adjacency.set(source, new Set());
    if (!this.adjacency.has(target)) this.adjacency.set(target, new Set());
    this.adjacency.get(source).add(target);
    this.adjacency.get(target).add(source);
  }

  // ── Query Engine ──

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(type) {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Get all neighbors of a node (optionally filtered by edge type)
   */
  getNeighbors(nodeId, edgeType = null) {
    const neighbors = [];
    for (const edge of this.edges) {
      if (edge.source === nodeId && (!edgeType || edge.type === edgeType)) {
        neighbors.push({ node: this.nodes.get(edge.target), edge });
      }
      if (edge.target === nodeId && (!edgeType || edge.type === edgeType)) {
        neighbors.push({ node: this.nodes.get(edge.source), edge });
      }
    }
    return neighbors.filter(n => n.node); // Filter nulls
  }

  /**
   * Find projects that use specific skills
   * @param {string[]} skills - List of skill labels
   * @returns {Object[]} Projects sorted by skill match count
   */
  findProjectsBySkills(skills) {
    const skillLower = skills.map(s => s.toLowerCase());
    const projectScores = new Map();

    for (const edge of this.edges) {
      if (edge.type !== EDGE_TYPES.USES_SKILL) continue;
      const skillNode = this.nodes.get(edge.target);
      if (!skillNode) continue;

      const matchIdx = skillLower.findIndex(s =>
        skillNode.label.toLowerCase().includes(s) || s.includes(skillNode.label.toLowerCase())
      );

      if (matchIdx >= 0) {
        const current = projectScores.get(edge.source) || { count: 0, weight: 0 };
        current.count++;
        current.weight += edge.weight;
        projectScores.set(edge.source, current);
      }
    }

    return Array.from(projectScores.entries())
      .map(([projectId, scores]) => ({
        project: this.nodes.get(projectId),
        matchCount: scores.count,
        totalWeight: scores.weight,
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight || b.matchCount - a.matchCount);
  }

  /**
   * Find skills shared across projects in a specific domain
   * @param {string} domain - Domain to filter
   * @returns {Object[]} Skills sorted by frequency
   */
  findDomainSkills(domain) {
    const domainLower = domain.toLowerCase();
    const domainProjects = new Set();

    // Find all projects in this domain
    for (const edge of this.edges) {
      if (edge.type !== EDGE_TYPES.BELONGS_TO) continue;
      const domainNode = this.nodes.get(edge.target);
      if (domainNode && domainNode.label.toLowerCase().includes(domainLower)) {
        domainProjects.add(edge.source);
      }
    }

    // Count skill usage across domain projects
    const skillCounts = new Map();
    for (const edge of this.edges) {
      if (edge.type !== EDGE_TYPES.USES_SKILL) continue;
      if (!domainProjects.has(edge.source)) continue;
      const skillNode = this.nodes.get(edge.target);
      if (!skillNode) continue;
      skillCounts.set(skillNode.label, (skillCounts.get(skillNode.label) || 0) + 1);
    }

    return Array.from(skillCounts.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Find the shortest path between two nodes (BFS)
   */
  findPath(sourceId, targetId) {
    if (!this.adjacency.has(sourceId) || !this.adjacency.has(targetId)) return null;

    const visited = new Set();
    const queue = [[sourceId]];
    visited.add(sourceId);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === targetId) {
        return path.map(id => this.nodes.get(id));
      }

      const neighbors = this.adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null;
  }

  /**
   * Get graph statistics
   */
  getStats() {
    const typeCount = {};
    for (const node of this.nodes.values()) {
      typeCount[node.type] = (typeCount[node.type] || 0) + 1;
    }
    const edgeTypeCount = {};
    for (const edge of this.edges) {
      edgeTypeCount[edge.type] = (edgeTypeCount[edge.type] || 0) + 1;
    }
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      nodesByType: typeCount,
      edgesByType: edgeTypeCount,
      version: this.version,
      builtAt: this.builtAt,
    };
  }

  // ── Persistence ──

  save() {
    if (!fs.existsSync(KG_DIR)) fs.mkdirSync(KG_DIR, { recursive: true });
    const data = {
      version: this.version,
      builtAt: this.builtAt,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
    fs.writeFileSync(KG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  static load() {
    const graph = new KnowledgeGraph();
    if (!fs.existsSync(KG_FILE)) return graph;

    try {
      const data = JSON.parse(fs.readFileSync(KG_FILE, 'utf-8'));
      graph.version = data.version || 3;
      graph.builtAt = data.builtAt;
      for (const node of data.nodes || []) {
        graph.addNode(node.id, node.type, node.label, node.properties);
      }
      for (const edge of data.edges || []) {
        graph.addEdge(edge.source, edge.target, edge.type, edge.weight, edge.properties);
      }
      return graph;
    } catch {
      return graph;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Entity Extractor — Builds nodes from brain data
// ═══════════════════════════════════════════════════════════════════════════

export function extractEntities(brain) {
  const graph = new KnowledgeGraph();

  // ── Projects ──
  for (const project of (brain.projects || [])) {
    const pid = `proj_${(project.name || '').toLowerCase().replace(/\s+/g, '_').substring(0, 40)}`;
    graph.addNode(pid, NODE_TYPES.PROJECT, project.name, {
      subtitle: project.subtitle || '',
      bullets: project.bullets || [],
      tags: project.tags || [],
      domain: project.domain || null,
    });

    // Extract skills from project tags
    for (const tag of (project.tags || [])) {
      const sid = `skill_${tag.toLowerCase().replace(/\s+/g, '_')}`;
      graph.addNode(sid, NODE_TYPES.SKILL, tag, {});
      graph.addEdge(pid, sid, EDGE_TYPES.USES_SKILL, 1.0);
    }

    // Domain assignment
    if (project.domain) {
      const did = `domain_${project.domain.toLowerCase().replace(/\s+/g, '_')}`;
      graph.addNode(did, NODE_TYPES.DOMAIN, project.domain, {});
      graph.addEdge(pid, did, EDGE_TYPES.BELONGS_TO, 1.0);
    }
  }

  // ── Experience (Companies + Roles) ──
  for (const exp of (brain.experience_detailed || [])) {
    const companyId = `company_${(exp.company || '').toLowerCase().replace(/\s+/g, '_')}`;
    const roleId = `role_${(exp.role || '').toLowerCase().replace(/\s+/g, '_')}_at_${(exp.company || '').toLowerCase().replace(/\s+/g, '_')}`;

    graph.addNode(companyId, NODE_TYPES.COMPANY, exp.company || 'Unknown', {
      location: exp.location || '',
    });

    graph.addNode(roleId, NODE_TYPES.ROLE, exp.role || 'Unknown', {
      company: exp.company,
      duration: exp.duration || '',
      industry_tags: exp.industry_tags || [],
    });

    graph.addEdge(roleId, companyId, EDGE_TYPES.WORKED_AT, 1.0);
    graph.addEdge(companyId, roleId, EDGE_TYPES.HAS_ROLE, 1.0);

    // Link achievements
    for (let i = 0; i < (exp.achievements || []).length; i++) {
      const achId = `ach_${companyId}_${i}`;
      graph.addNode(achId, NODE_TYPES.ACHIEVEMENT, exp.achievements[i].substring(0, 80), {
        full_text: exp.achievements[i],
      });
      graph.addEdge(achId, roleId, EDGE_TYPES.ACHIEVED_IN, 1.0);
    }

    // Link industry tags as domains
    for (const tag of (exp.industry_tags || [])) {
      const did = `domain_${tag.toLowerCase().replace(/\s+/g, '_')}`;
      graph.addNode(did, NODE_TYPES.DOMAIN, tag, {});
      graph.addEdge(roleId, did, EDGE_TYPES.BELONGS_TO, 0.8);
    }
  }

  // ── Skills from profile ──
  const skillsBlocks = brain.profile?.skills_summary?.blocks || {};
  for (const [blockName, skillsStr] of Object.entries(skillsBlocks)) {
    const skills = typeof skillsStr === 'string'
      ? skillsStr.split(',').map(s => s.trim())
      : Array.isArray(skillsStr) ? skillsStr : [];

    for (const skill of skills) {
      if (!skill) continue;
      const sid = `skill_${skill.toLowerCase().replace(/\s+/g, '_')}`;
      graph.addNode(sid, NODE_TYPES.SKILL, skill, { block: blockName });
    }
  }

  // ── Skill→Project index (from brain) ──
  const skillProjectIndex = brain.skill_project_index || {};
  for (const [skill, entry] of Object.entries(skillProjectIndex)) {
    const sid = `skill_${skill.toLowerCase().replace(/\s+/g, '_')}`;
    graph.addNode(sid, NODE_TYPES.SKILL, skill, {});

    // Handle both formats: { projects: [...] } or plain array
    const projectNames = Array.isArray(entry) ? entry : (entry?.projects || []);
    for (const projName of projectNames) {
      if (typeof projName !== 'string') continue;
      const pid = `proj_${projName.toLowerCase().replace(/\s+/g, '_').substring(0, 40)}`;
      if (graph.nodes.has(pid)) {
        graph.addEdge(pid, sid, EDGE_TYPES.USES_SKILL, 1.5);
      }
    }
  }

  // ── Education ──
  for (const edu of (brain.profile?.education_detailed || [])) {
    const eid = `edu_${(edu.institution || '').toLowerCase().replace(/\s+/g, '_')}`;
    graph.addNode(eid, NODE_TYPES.EDUCATION, edu.institution || 'Unknown', {
      degree: edu.degree || '',
      year: edu.year || '',
      gpa: edu.gpa || null,
    });
  }

  // ── Domain Index (from brain) ──
  const domainIndex = brain.domain_index || {};
  for (const [domain, entry] of Object.entries(domainIndex)) {
    const did = `domain_${domain.toLowerCase().replace(/\s+/g, '_')}`;
    graph.addNode(did, NODE_TYPES.DOMAIN, domain, {});

    // Handle both formats: plain array or object with project list
    const projectNames = Array.isArray(entry) ? entry : (entry?.projects || []);
    for (const projName of projectNames) {
      if (typeof projName !== 'string') continue;
      const pid = `proj_${projName.toLowerCase().replace(/\s+/g, '_').substring(0, 40)}`;
      if (graph.nodes.has(pid)) {
        graph.addEdge(pid, did, EDGE_TYPES.BELONGS_TO, 1.0);
      }
    }
  }

  graph.builtAt = new Date().toISOString();
  return graph;
}

// ═══════════════════════════════════════════════════════════════════════════
// Relationship Builder — Infers connections between entities
// ═══════════════════════════════════════════════════════════════════════════

export function buildRelationships(graph) {
  const skillNodes = graph.getNodesByType(NODE_TYPES.SKILL);

  // ── Skill-to-Skill relationships (co-occurrence in projects) ──
  const skillProjects = new Map(); // skillId → Set(projectIds)

  for (const edge of graph.edges) {
    if (edge.type !== EDGE_TYPES.USES_SKILL) continue;
    if (!skillProjects.has(edge.target)) skillProjects.set(edge.target, new Set());
    skillProjects.get(edge.target).add(edge.source);
  }

  // Find skills that co-occur in 2+ projects
  const skillIds = Array.from(skillProjects.keys());
  for (let i = 0; i < skillIds.length; i++) {
    for (let j = i + 1; j < skillIds.length; j++) {
      const projs1 = skillProjects.get(skillIds[i]);
      const projs2 = skillProjects.get(skillIds[j]);
      const overlap = [...projs1].filter(p => projs2.has(p)).length;
      if (overlap >= 2) {
        graph.addEdge(skillIds[i], skillIds[j], EDGE_TYPES.RELATED_TO, overlap * 0.5, {
          co_occurrence: overlap,
        });
      }
    }
  }

  // ── Project→Company relationships ──
  for (const project of graph.getNodesByType(NODE_TYPES.PROJECT)) {
    // Try to find company from project tags or properties
    const projectTags = project.properties.tags || [];
    for (const company of graph.getNodesByType(NODE_TYPES.COMPANY)) {
      const companyLower = company.label.toLowerCase();
      const projectLower = project.label.toLowerCase();
      // Check if project name or tags mention the company
      if (projectLower.includes(companyLower) || projectTags.some(t => t.toLowerCase().includes(companyLower))) {
        graph.addEdge(project.id, company.id, EDGE_TYPES.PRODUCED_BY, 1.0);
      }
    }
  }

  // ── Domain→Skill requirements ──
  const domainSkills = new Map(); // domainId → Map(skillId → count)
  for (const edge of graph.edges) {
    if (edge.type !== EDGE_TYPES.BELONGS_TO) continue;
    const sourceNode = graph.nodes.get(edge.source);
    if (!sourceNode || sourceNode.type !== NODE_TYPES.PROJECT) continue;

    // Get skills for this project
    const projectSkills = graph.getNeighbors(edge.source, EDGE_TYPES.USES_SKILL);
    for (const { node: skillNode } of projectSkills) {
      if (!skillNode) continue;
      if (!domainSkills.has(edge.target)) domainSkills.set(edge.target, new Map());
      const counts = domainSkills.get(edge.target);
      counts.set(skillNode.id, (counts.get(skillNode.id) || 0) + 1);
    }
  }

  // Create domain→skill edges for skills used in 2+ projects of that domain
  for (const [domainId, skillMap] of domainSkills.entries()) {
    for (const [skillId, count] of skillMap.entries()) {
      if (count >= 2) {
        graph.addEdge(domainId, skillId, EDGE_TYPES.REQUIRES_SKILL, count * 0.3, {
          usage_count: count,
        });
      }
    }
  }

  return graph;
}

// ═══════════════════════════════════════════════════════════════════════════
// ATS Pipeline Integration — Graph-Aware Project Selection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Use the knowledge graph to find the best projects for a given JD
 * @param {KnowledgeGraph} graph - Built knowledge graph
 * @param {Object} jdIntel - JD intelligence output
 * @param {number} maxProjects - Max projects to return
 * @returns {Object[]} Ranked projects with graph-based scores
 */
export function graphAwareProjectSelection(graph, jdIntel, maxProjects = 4) {
  const jdSkills = [
    ...(jdIntel.required_skills || []),
    ...(jdIntel.preferred_skills || []),
    ...(jdIntel.technologies || []),
  ];
  const jdDomain = jdIntel.domain || 'general';

  // Strategy 1: Direct skill match
  const skillMatches = graph.findProjectsBySkills(jdSkills);

  // Strategy 2: Domain affinity
  const domainSkills = graph.findDomainSkills(jdDomain);
  const domainSkillNames = domainSkills.map(s => s.skill);

  // Strategy 3: Transitive skill matches (skills related to JD skills)
  const transitiveSkills = new Set();
  for (const skill of jdSkills) {
    const sid = `skill_${skill.toLowerCase().replace(/\s+/g, '_')}`;
    const related = graph.getNeighbors(sid, EDGE_TYPES.RELATED_TO);
    for (const { node } of related) {
      if (node) transitiveSkills.add(node.label);
    }
  }

  // Combine direct + transitive skill matches
  const allMatchSkills = [...new Set([...jdSkills, ...transitiveSkills, ...domainSkillNames])];
  const combinedMatches = graph.findProjectsBySkills(allMatchSkills);

  // Score and rank
  const projectScores = new Map();

  for (const match of skillMatches) {
    const pid = match.project.id;
    const current = projectScores.get(pid) || { project: match.project, directScore: 0, transitiveScore: 0, domainScore: 0 };
    current.directScore = match.totalWeight * 2; // Direct matches weighted 2x
    projectScores.set(pid, current);
  }

  for (const match of combinedMatches) {
    const pid = match.project.id;
    const current = projectScores.get(pid) || { project: match.project, directScore: 0, transitiveScore: 0, domainScore: 0 };
    current.transitiveScore = match.totalWeight * 0.5;
    projectScores.set(pid, current);
  }

  // Domain boost
  for (const [pid, scores] of projectScores.entries()) {
    const projDomains = graph.getNeighbors(pid, EDGE_TYPES.BELONGS_TO);
    for (const { node } of projDomains) {
      if (node && node.label.toLowerCase().includes(jdDomain.toLowerCase())) {
        scores.domainScore += 3;
      }
    }
  }

  const ranked = Array.from(projectScores.values())
    .map(s => ({
      project: s.project,
      totalScore: s.directScore + s.transitiveScore + s.domainScore,
      breakdown: { direct: s.directScore, transitive: s.transitiveScore, domain: s.domainScore },
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, maxProjects);

  return ranked;
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Full Graph from Brain Data
// ═══════════════════════════════════════════════════════════════════════════

export function buildKnowledgeGraph(brain) {
  console.log('🧠 Building Knowledge Graph v3...');

  const graph = extractEntities(brain);
  buildRelationships(graph);

  const stats = graph.getStats();
  console.log(`✅ Knowledge Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
  console.log('   Nodes by type:', JSON.stringify(stats.nodesByType));
  console.log('   Edges by type:', JSON.stringify(stats.edgesByType));

  graph.save();
  console.log(`💾 Saved to ${KG_FILE}`);

  return graph;
}

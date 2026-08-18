'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, FolderOpen, FileText, ChevronRight, LayoutTemplate } from 'lucide-react';
import { codebaseTaxonomy } from '@/shared/data/codebaseTaxonomy';

const TreeNode = ({ node, level = 0, onSelectFile, onSelectFolder }) => {
  const [isOpen, setIsOpen] = useState(level < 1);
  const isDir = node.type === 'directory';

  const handleClick = (e) => {
    e.stopPropagation();
    if (isDir) {
      setIsOpen(!isOpen);
      onSelectFolder(node.path);
    } else {
      onSelectFile(node);
    }
  };

  const Icon = isDir ? (isOpen ? FolderOpen : Folder) : FileText;

  return (
    <div className="select-none">
      <div 
        onClick={handleClick}
        className={`flex items-center py-1.5 px-2 hover:bg-[var(--bg-elevated)] cursor-pointer rounded-md text-sm transition-colors ${level === 0 ? 'mt-2' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {isDir && (
          <ChevronRight 
            size={14} 
            className={`mr-1 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
        )}
        {!isDir && <span className="w-[18px]" />}
        <Icon 
          size={16} 
          className={`mr-2 ${isDir ? 'text-[var(--c-primary)]' : 'text-[var(--text-muted)]'}`}
        />
        <span className={`truncate ${isDir ? 'font-medium text-[var(--text-base)]' : 'text-[var(--text-secondary)]'}`}>
          {node.name}
        </span>
        
        {!isDir && node.data && (
          <span className="ml-auto text-[10px] text-[var(--text-muted)] bg-[var(--bg-base)] px-1.5 py-0.5 rounded border border-[var(--border-color)] hidden group-hover:block">
            {node.data.nodeCount} nodes
          </span>
        )}
      </div>

      <AnimatePresence>
        {isDir && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children.map((child, idx) => (
              <TreeNode 
                key={`${child.path}-${idx}`} 
                node={child} 
                level={level + 1} 
                onSelectFile={onSelectFile}
                onSelectFolder={onSelectFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function CodebaseTree({ onSelectFile, onSelectFolder }) {
  const [files, setFiles] = useState([]);
  
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'files' })
        });
        const data = await res.json();
        if (Array.isArray(data)) setFiles(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFiles();
  }, []);

  // Build a tree from flat file paths
  const tree = useMemo(() => {
    if (!files || !Array.isArray(files) || files.length === 0) return [];
    
    const root = [];
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath += (currentPath ? '/' : '') + part;
        const isFile = index === parts.length - 1;
        
        let existingNode = currentLevel.find(n => n.name === part);
        
        if (!existingNode) {
          existingNode = {
            name: part,
            path: '/' + currentPath,
            type: isFile ? 'file' : 'directory',
            children: isFile ? null : [],
            data: isFile ? file : null
          };
          currentLevel.push(existingNode);
        }
        
        if (!isFile) {
          currentLevel = existingNode.children;
        }
      });
    });

    // Sort: directories first, then alphabetically
    const sortTree = (nodes) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
      nodes.forEach(n => {
        if (n.children) sortTree(n.children);
      });
    };
    
    sortTree(root);
    return root;
  }, [files]);

  return (
    <div className="w-full h-full overflow-y-auto p-4 custom-scrollbar">
      <div className="mb-4 pb-4 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-semibold text-[var(--text-base)] flex items-center">
          <LayoutTemplate size={16} className="mr-2 text-[var(--c-primary)]" />
          Deep Codebase Explorer
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          100% Comprehensive File Tree
        </p>
      </div>
      
      {tree.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)] flex items-center justify-center h-32">
          Loading codebase tree...
        </div>
      ) : (
        <div className="pb-8">
          {tree.map((node, idx) => (
            <TreeNode 
              key={`${node.path}-${idx}`} 
              node={node} 
              onSelectFile={onSelectFile}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

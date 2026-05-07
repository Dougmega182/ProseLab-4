// src/components/LoreAgent/RelationshipGraph.jsx

import React, { useRef, useEffect, useState, useCallback } from 'react';

export default function RelationshipGraph({
  entities,
  relationships,
  selectedEntity,
  onSelectEntity,
  agent,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const dragRef = useRef(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [graphFilter, setGraphFilter] = useState({ minConfidence: 0.3, types: null });

  // Build graph data from entities and relationships
  useEffect(() => {
    if (!agent) return;

    const graph = agent.getGraph({
      minConfidence: graphFilter.minConfidence,
      entityTypes: graphFilter.types,
    });

    // Initialize positions randomly if new
    const existingPositions = {};
    for (const node of nodesRef.current) {
      existingPositions[node.id] = { x: node.x, y: node.y, vx: node.vx, vy: node.vy };
    }

    const canvas = canvasRef.current;
    const width = canvas?.width || 800;
    const height = canvas?.height || 600;

    nodesRef.current = graph.nodes.map(node => {
      const existing = existingPositions[node.id];
      return {
        ...node,
        x: existing?.x ?? (Math.random() * width - width / 2),
        y: existing?.y ?? (Math.random() * height - height / 2),
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        radius: Math.max(8, Math.min(25, 5 + (node.mentions || 1) * 2)),
      };
    });

    edgesRef.current = graph.edges.map(edge => ({
      ...edge,
      sourceNode: nodesRef.current.find(n => n.id === edge.source),
      targetNode: nodesRef.current.find(n => n.id === edge.target),
    })).filter(e => e.sourceNode && e.targetNode);
  }, [entities, relationships, agent, graphFilter]);

  // Force-directed simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes.length === 0) return;

    const REPULSION = 5000;
    const ATTRACTION = 0.005;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.01;

    // Reset forces
    for (const node of nodes) {
      node.fx = 0;
      node.fy = 0;
    }

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].fx -= fx;
        nodes[i].fy -= fy;
        nodes[j].fx += fx;
        nodes[j].fy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const s = edge.sourceNode;
      const t = edge.targetNode;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * ATTRACTION * (edge.weight || 1);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.fx += fx;
      s.fy += fy;
      t.fx -= fx;
      t.fy -= fy;
    }

    // Center gravity
    for (const node of nodes) {
      node.fx -= node.x * CENTER_GRAVITY;
      node.fy -= node.y * CENTER_GRAVITY;
    }

    // Apply forces
    for (const node of nodes) {
      if (dragRef.current?.id === node.id) continue;
      node.vx = (node.vx + node.fx) * DAMPING;
      node.vy = (node.vy + node.fy) * DAMPING;
      node.x += node.vx;
      node.y += node.vy;
    }
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight || 500;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      simulate();

      const width = canvas.width;
      const height = canvas.height;
      const zoom = zoomRef.current;
      const pan = panRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);

      // Draw edges
      for (const edge of edgesRef.current) {
        const s = edge.sourceNode;
        const t = edge.targetNode;
        const alpha = Math.max(0.15, edge.weight || 0.5);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `rgba(150, 150, 170, ${alpha})`;
        ctx.lineWidth = Math.max(1, (edge.weight || 1) * 2);
        ctx.stroke();

        // Edge label
        if (zoom > 0.7 && edge.label) {
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2;
          ctx.fillStyle = 'rgba(200, 200, 220, 0.8)';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, mx, my - 4);
        }
      }

      // Draw nodes
      for (const node of nodesRef.current) {
        const isSelected = selectedEntity?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const color = getTypeColor(node.type);

        // Glow for selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = `${color}44`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? lightenColor(color) : color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.3)';
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();

        // Verified checkmark
        if (node.verified) {
          ctx.fillStyle = '#fff';
          ctx.font = `${Math.max(8, node.radius * 0.7)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', node.x, node.y);
        }

        // Label
        if (zoom > 0.5 || isSelected || isHovered) {
          ctx.fillStyle = '#e0e0e0';
          ctx.font = `${isSelected ? 'bold ' : ''}11px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(node.label || node.name, node.x, node.y + node.radius + 4);
        }
      }

      ctx.restore();

      // Tooltip for hovered node
      if (hoveredNode) {
        const screenX = (hoveredNode.x * zoom) + width / 2 + pan.x;
        const screenY = (hoveredNode.y * zoom) + height / 2 + pan.y;
        const tooltipText = `${hoveredNode.name} (${hoveredNode.type}) - ${(hoveredNode.confidence * 100).toFixed(0)}%`;
        ctx.fillStyle = 'rgba(30, 30, 40, 0.9)';
        const textWidth = ctx.measureText(tooltipText).width;
        ctx.fillRect(screenX - textWidth / 2 - 6, screenY - 30, textWidth + 12, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipText, screenX, screenY - 20);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simulate, selectedEntity, hoveredNode]);

  // Mouse interaction handlers
  const getNodeAtPosition = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const mx = (clientX - rect.left - canvas.width / 2 - pan.x) / zoom;
    const my = (clientY - rect.top - canvas.height / 2 - pan.y) / zoom;

    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < node.radius * node.radius) {
        return node;
      }
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e) => {
    const node = getNodeAtPosition(e.clientX, e.clientY);
    if (node) {
      dragRef.current = node;
    } else {
      dragRef.current = { isPan: true, startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
    }
  }, [getNodeAtPosition]);

  const handleMouseMove = useCallback((e) => {
    if (dragRef.current) {
      if (dragRef.current.isPan) {
        panRef.current = {
          x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
          y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
        };
      } else {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const zoom = zoomRef.current;
        const pan = panRef.current;
        dragRef.current.x = (e.clientX - rect.left - canvas.width / 2 - pan.x) / zoom;
        dragRef.current.y = (e.clientY - rect.top - canvas.height / 2 - pan.y) / zoom;
        dragRef.current.vx = 0;
        dragRef.current.vy = 0;
      }
    } else {
      const node = getNodeAtPosition(e.clientX, e.clientY);
      setHoveredNode(node);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
      }
    }
  }, [getNodeAtPosition]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current && !dragRef.current.isPan) {
      const node = dragRef.current;
      const entity = entities.find(en => en.id === node.id);
      if (entity) onSelectEntity(entity);
    }
    dragRef.current = null;
  }, [entities, onSelectEntity]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomRef.current = Math.max(0.1, Math.min(5, zoomRef.current * delta));
  }, []);

  return (
    <div className="graph-container">
      <div className="graph-controls">
        <label>
          Min Confidence:
          <input
            type="range"
            min="0"
            max="100"
            value={graphFilter.minConfidence * 100}
            onChange={e => setGraphFilter(prev => ({
              ...prev,
              minConfidence: parseInt(e.target.value) / 100,
            }))}
          />
          <span>{(graphFilter.minConfidence * 100).toFixed(0)}%</span>
        </label>
        <button onClick={() => { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }}>
          Reset View
        </button>
        <span className="graph-info">
          {nodesRef.current.length} nodes, {edgesRef.current.length} edges
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current = null; setHoveredNode(null); }}
        onWheel={handleWheel}
      />
      <div className="graph-legend">
        {['character', 'location', 'item', 'event', 'faction', 'concept', 'creature'].map(type => (
          <div key={type} className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: getTypeColor(type) }} />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTypeColor(type) {
  const colors = {
    character: '#4A90D9',
    location: '#2ECC71',
    item: '#E67E22',
    event: '#9B59B6',
    faction: '#E74C3C',
    concept: '#1ABC9C',
    creature: '#F39C12',
    unknown: '#95A5A6',
  };
  return colors[type] || colors.unknown;
}

function lightenColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
}

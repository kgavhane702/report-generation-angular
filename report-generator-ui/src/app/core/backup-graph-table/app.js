const state = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  idCounter: 1,
};

const svg = document.getElementById("graphSvg");
const statusText = document.getElementById("statusText");

const refs = {
  nodeLabel: document.getElementById("nodeLabel"),
  nodeColumns: document.getElementById("nodeColumns"),
  nodeWidth: document.getElementById("nodeWidth"),
  nodeHeight: document.getElementById("nodeHeight"),
  addNodeBtn: document.getElementById("addNodeBtn"),

  fromNode: document.getElementById("fromNode"),
  toNode: document.getElementById("toNode"),
  edgeLabel: document.getElementById("edgeLabel"),
  connectBtn: document.getElementById("connectBtn"),
  disconnectBtn: document.getElementById("disconnectBtn"),

  splitNode: document.getElementById("splitNode"),
  splitRatio: document.getElementById("splitRatio"),
  splitBtn: document.getElementById("splitBtn"),

  mergeA: document.getElementById("mergeA"),
  mergeB: document.getElementById("mergeB"),
  mergeBtn: document.getElementById("mergeBtn"),

  selectedNode: document.getElementById("selectedNode"),
  editWidth: document.getElementById("editWidth"),
  editHeight: document.getElementById("editHeight"),
  editRows: document.getElementById("editRows"),
  editCols: document.getElementById("editCols"),
  applyEditBtn: document.getElementById("applyEditBtn"),
  deleteNodeBtn: document.getElementById("deleteNodeBtn"),
};

let drag = {
  nodeId: null,
  offsetX: 0,
  offsetY: 0,
};

function uid() {
  return `T${state.idCounter++}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function byId(id) {
  return state.nodes.find((node) => node.id === id);
}

function createNode({ label, width, height, columns, rows = 4, x = 150, y = 120 }) {
  return {
    id: uid(),
    label,
    width,
    height,
    columns,
    rows,
    x,
    y,
  };
}

function addNode() {
  const label = refs.nodeLabel.value.trim() || `Table ${state.idCounter}`;
  const width = clamp(toInt(refs.nodeWidth.value, 220), 120, 460);
  const height = clamp(toInt(refs.nodeHeight.value, 130), 90, 340);
  const columns = clamp(toInt(refs.nodeColumns.value, 4), 1, 20);

  const index = state.nodes.length;
  const x = 110 + (index % 4) * 280;
  const y = 100 + Math.floor(index / 4) * 190;

  const node = createNode({ label, width, height, columns, rows: 4, x, y });
  state.nodes.push(node);
  state.selectedNodeId = node.id;

  refreshSelectors();
  render();
  setStatus(`Inserted ${node.id} (${node.label}).`);
}

function connectNodes() {
  const from = refs.fromNode.value;
  const to = refs.toNode.value;
  if (!from || !to) {
    setStatus("Select both source and target nodes.");
    return;
  }
  if (from === to) {
    setStatus("A node cannot connect to itself.");
    return;
  }

  const edgeId = `${from}->${to}`;
  const exists = state.edges.some((edge) => edge.id === edgeId);
  if (exists) {
    setStatus("Connection already exists.");
    return;
  }

  state.edges.push({
    id: edgeId,
    from,
    to,
    label: refs.edgeLabel.value.trim() || "link",
  });

  render();
  setStatus(`Connected ${from} to ${to}.`);
}

function disconnectNodes() {
  const from = refs.fromNode.value;
  const to = refs.toNode.value;
  if (!from || !to) {
    setStatus("Select both source and target nodes.");
    return;
  }

  const before = state.edges.length;
  state.edges = state.edges.filter((edge) => !(edge.from === from && edge.to === to));
  const removed = before - state.edges.length;

  render();
  setStatus(removed ? `Disconnected ${from} and ${to}.` : "No edge to disconnect.");
}

function splitNode() {
  const id = refs.splitNode.value;
  const node = byId(id);
  if (!node) {
    setStatus("Choose a node to split.");
    return;
  }

  const ratio = clamp(toInt(refs.splitRatio.value, 50), 10, 90) / 100;
  const leftWidth = Math.max(120, Math.round(node.width * ratio));
  const rightWidth = Math.max(120, node.width - leftWidth);

  node.width = leftWidth;
  node.label = `${node.label} A`;

  const newNode = createNode({
    label: `${node.label.replace(/ A$/, "")} B`,
    width: rightWidth,
    height: node.height,
    columns: Math.max(1, Math.ceil(node.columns / 2)),
    rows: node.rows,
    x: node.x + leftWidth + 60,
    y: node.y,
  });

  node.columns = Math.max(1, node.columns - newNode.columns);
  state.nodes.push(newNode);

  state.edges.push({
    id: `${node.id}->${newNode.id}`,
    from: node.id,
    to: newNode.id,
    label: "split",
  });

  state.selectedNodeId = newNode.id;
  refreshSelectors();
  render();
  setStatus(`Split ${id} into ${node.id} and ${newNode.id}.`);
}

function mergeNodes() {
  const aId = refs.mergeA.value;
  const bId = refs.mergeB.value;

  if (!aId || !bId || aId === bId) {
    setStatus("Select two different nodes to merge.");
    return;
  }

  const a = byId(aId);
  const b = byId(bId);
  if (!a || !b) {
    setStatus("One of the selected nodes does not exist.");
    return;
  }

  const merged = createNode({
    label: `${a.label} + ${b.label}`,
    width: clamp(a.width + b.width, 120, 640),
    height: clamp(Math.max(a.height, b.height), 90, 400),
    columns: a.columns + b.columns,
    rows: Math.max(a.rows, b.rows),
    x: Math.round((a.x + b.x) / 2),
    y: Math.round((a.y + b.y) / 2),
  });

  state.nodes = state.nodes.filter((n) => n.id !== aId && n.id !== bId);

  const rewired = [];
  for (const edge of state.edges) {
    if ((edge.from === aId || edge.from === bId) && (edge.to === aId || edge.to === bId)) {
      continue;
    }
    const from = edge.from === aId || edge.from === bId ? merged.id : edge.from;
    const to = edge.to === aId || edge.to === bId ? merged.id : edge.to;
    if (from === to) continue;
    rewired.push({ id: `${from}->${to}`, from, to, label: edge.label });
  }

  const unique = [];
  const seen = new Set();
  for (const edge of rewired) {
    if (!seen.has(edge.id)) {
      seen.add(edge.id);
      unique.push(edge);
    }
  }

  state.nodes.push(merged);
  state.edges = unique;
  state.selectedNodeId = merged.id;

  refreshSelectors();
  render();
  setStatus(`Merged ${aId} and ${bId} into ${merged.id}.`);
}

function deleteSelectedNode() {
  const id = refs.selectedNode.value;
  if (!id) {
    setStatus("No node selected.");
    return;
  }

  const node = byId(id);
  if (!node) {
    setStatus("Selected node no longer exists.");
    return;
  }

  state.nodes = state.nodes.filter((n) => n.id !== id);
  state.edges = state.edges.filter((edge) => edge.from !== id && edge.to !== id);
  state.selectedNodeId = state.nodes[0]?.id || null;

  refreshSelectors();
  render();
  setStatus(`Deleted node ${id}.`);
}

function applyNodeEdit() {
  const id = refs.selectedNode.value;
  const node = byId(id);
  if (!node) {
    setStatus("Select a valid node to edit.");
    return;
  }

  node.width = clamp(toInt(refs.editWidth.value, node.width), 120, 640);
  node.height = clamp(toInt(refs.editHeight.value, node.height), 90, 400);
  node.rows = clamp(toInt(refs.editRows.value, node.rows), 1, 50);
  node.columns = clamp(toInt(refs.editCols.value, node.columns), 1, 50);

  render();
  setStatus(`Updated ${id}.`);
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function refreshSelectors() {
  const selectors = [
    refs.fromNode,
    refs.toNode,
    refs.splitNode,
    refs.mergeA,
    refs.mergeB,
    refs.selectedNode,
  ];

  for (const select of selectors) {
    const current = select.value;
    select.innerHTML = "";

    for (const node of state.nodes) {
      const option = document.createElement("option");
      option.value = node.id;
      option.textContent = `${node.id} - ${node.label}`;
      select.appendChild(option);
    }

    if (state.nodes.length === 0) continue;

    if (state.nodes.some((node) => node.id === current)) {
      select.value = current;
    } else if (state.selectedNodeId && state.nodes.some((n) => n.id === state.selectedNodeId)) {
      select.value = state.selectedNodeId;
    } else {
      select.selectedIndex = 0;
    }
  }

  const selected = byId(refs.selectedNode.value);
  if (selected) {
    refs.editWidth.value = selected.width;
    refs.editHeight.value = selected.height;
    refs.editRows.value = selected.rows;
    refs.editCols.value = selected.columns;
    state.selectedNodeId = selected.id;
  } else {
    refs.editWidth.value = "";
    refs.editHeight.value = "";
    refs.editRows.value = "";
    refs.editCols.value = "";
  }
}

function svgPointFromEvent(event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const transformed = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: transformed.x, y: transformed.y };
}

function render() {
  svg.innerHTML = "";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");

  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowPath.setAttribute("fill", "#82a4ff");
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  for (const edge of state.edges) {
    const from = byId(edge.from);
    const to = byId(edge.to);
    if (!from || !to) continue;

    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute(
      "d",
      `M ${startX} ${startY} C ${startX + 80} ${startY}, ${endX - 80} ${endY}, ${endX} ${endY}`
    );
    line.setAttribute("class", "edge-line");
    svg.appendChild(line);

    const mx = (startX + endX) / 2;
    const my = (startY + endY) / 2 - 8;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(mx));
    label.setAttribute("y", String(my));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "edge-label");
    label.textContent = edge.label;
    svg.appendChild(label);
  }

  for (const node of state.nodes) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `node${state.selectedNodeId === node.id ? " selected" : ""}`);
    group.dataset.nodeId = node.id;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(node.x));
    rect.setAttribute("y", String(node.y));
    rect.setAttribute("width", String(node.width));
    rect.setAttribute("height", String(node.height));
    rect.setAttribute("class", "main");

    const header = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    header.setAttribute("x", String(node.x));
    header.setAttribute("y", String(node.y));
    header.setAttribute("width", String(node.width));
    header.setAttribute("height", "26");
    header.setAttribute("class", "header");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", String(node.x + 10));
    title.setAttribute("y", String(node.y + 17));
    title.textContent = `${node.id}: ${node.label}`;

    const shapeInfo = document.createElementNS("http://www.w3.org/2000/svg", "text");
    shapeInfo.setAttribute("x", String(node.x + 10));
    shapeInfo.setAttribute("y", String(node.y + 46));
    shapeInfo.textContent = `W:${node.width} H:${node.height}`;

    const tableInfo = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tableInfo.setAttribute("x", String(node.x + 10));
    tableInfo.setAttribute("y", String(node.y + 66));
    tableInfo.textContent = `Rows:${node.rows} Cols:${node.columns}`;

    const cellHeight = (node.height - 80) / Math.max(1, Math.min(node.rows, 5));
    for (let i = 0; i < Math.min(node.rows, 5); i += 1) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const y = node.y + 78 + i * cellHeight;
      line.setAttribute("x1", String(node.x + 8));
      line.setAttribute("x2", String(node.x + node.width - 8));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke", "#32528e");
      line.setAttribute("stroke-width", "1");
      group.appendChild(line);
    }

    group.appendChild(rect);
    group.appendChild(header);
    group.appendChild(title);
    group.appendChild(shapeInfo);
    group.appendChild(tableInfo);

    group.addEventListener("pointerdown", onNodePointerDown);
    group.addEventListener("click", () => {
      state.selectedNodeId = node.id;
      refreshSelectors();
      render();
    });

    svg.appendChild(group);
  }
}

function onNodePointerDown(event) {
  const group = event.currentTarget;
  const id = group.dataset.nodeId;
  const node = byId(id);
  if (!node) return;

  state.selectedNodeId = node.id;
  refreshSelectors();

  const point = svgPointFromEvent(event);
  drag = {
    nodeId: node.id,
    offsetX: point.x - node.x,
    offsetY: point.y - node.y,
  };

  svg.setPointerCapture(event.pointerId);
}

svg.addEventListener("pointermove", (event) => {
  if (!drag.nodeId) return;
  const node = byId(drag.nodeId);
  if (!node) return;

  const point = svgPointFromEvent(event);
  node.x = point.x - drag.offsetX;
  node.y = point.y - drag.offsetY;

  node.x = clamp(node.x, 20, 1320 - node.width);
  node.y = clamp(node.y, 20, 760 - node.height);

  render();
});

svg.addEventListener("pointerup", () => {
  drag = { nodeId: null, offsetX: 0, offsetY: 0 };
});

refs.addNodeBtn.addEventListener("click", addNode);
refs.connectBtn.addEventListener("click", connectNodes);
refs.disconnectBtn.addEventListener("click", disconnectNodes);
refs.splitBtn.addEventListener("click", splitNode);
refs.mergeBtn.addEventListener("click", mergeNodes);
refs.applyEditBtn.addEventListener("click", applyNodeEdit);
refs.deleteNodeBtn.addEventListener("click", deleteSelectedNode);

refs.selectedNode.addEventListener("change", () => {
  state.selectedNodeId = refs.selectedNode.value || null;
  refreshSelectors();
  render();
});

const seedNodes = [
  createNode({ label: "Users", width: 230, height: 145, columns: 5, rows: 6, x: 100, y: 120 }),
  createNode({ label: "Orders", width: 240, height: 150, columns: 6, rows: 7, x: 430, y: 280 }),
  createNode({ label: "Payments", width: 220, height: 130, columns: 4, rows: 4, x: 770, y: 130 }),
];

state.nodes.push(...seedNodes);
state.edges.push(
  { id: `${seedNodes[0].id}->${seedNodes[1].id}`, from: seedNodes[0].id, to: seedNodes[1].id, label: "1:N" },
  { id: `${seedNodes[1].id}->${seedNodes[2].id}`, from: seedNodes[1].id, to: seedNodes[2].id, label: "N:1" }
);
state.selectedNodeId = seedNodes[0].id;

refreshSelectors();
render();
setStatus("Graph-based table designer initialized.");

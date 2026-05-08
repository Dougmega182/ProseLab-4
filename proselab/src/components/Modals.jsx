import { useEffect, useState } from "react";

function normalizeCharacterInput(char) {
  return {
    id: char?.id || null,
    name: char?.name || "",
    role: char?.role || "",
    trait: char?.trait || "",
    archetype: char?.archetype || "",
    motivation: char?.motivation || "",
    description: char?.description || char?.notes || "",
    physiology: char?.physiology || char?.Physiology || "",
    psychology: char?.psychology || char?.Psychology || "",
    constraints: char?.constraints || ""
  };
}

function normalizeSceneInput(scene) {
  return {
    id: scene?.id || null,
    title: scene?.title || "",
    chapter: scene?.chapter || 1,
    location: scene?.location || "",
    time: scene?.time || "",
    chars: scene?.chars || "",
    objects: scene?.objects || "",
    summary: scene?.summary || "",
    causalityType: scene?.causalityType || "linear",
    causality: scene?.causality || "",
    output: scene?.output || "",
    stakes: scene?.stakes || "",
    status: scene?.status || "draft",
    notes: scene?.notes || ""
  };
}

function ModalFrame({ title, subtitle, children, onClose, maxWidth = 760 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-shell" style={{ maxWidth }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">Preproduction Editor</div>
            <div className="modal-title">{title}</div>
            {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
          </div>
          <button className="modal-close" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CharModal({ char, onSave, onClose, onDelete }) {
  const [data, setData] = useState(() => normalizeCharacterInput(char));

  useEffect(() => {
    setData(normalizeCharacterInput(char));
  }, [char]);

  const updateField = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({
      ...char,
      ...data,
      Physiology: data.physiology,
      Psychology: data.psychology
    });
  };

  return (
    <ModalFrame
      title={char?.id ? "Character dossier" : "New character dossier"}
      subtitle="Refine motivation, pressure, and voice so imported cast members become editable story assets."
      onClose={onClose}
      maxWidth={860}
    >
      <div className="modal-grid modal-grid-two">
        <div className="field-group">
          <label className="field-label">Name</label>
          <input className="field-input" value={data.name} onChange={e => updateField("name", e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">Narrative Role</label>
          <input className="field-input" value={data.role} onChange={e => updateField("role", e.target.value)} placeholder="Protagonist, foil, mentor, antagonist..." />
        </div>
      </div>

      <div className="modal-grid modal-grid-three">
        <div className="field-group">
          <label className="field-label">Signature Trait</label>
          <input className="field-input" value={data.trait} onChange={e => updateField("trait", e.target.value)} placeholder="What is legible on the page immediately?" />
        </div>
        <div className="field-group">
          <label className="field-label">Archetype</label>
          <input className="field-input" value={data.archetype} onChange={e => updateField("archetype", e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">Constraint / Wound</label>
          <input className="field-input" value={data.constraints} onChange={e => updateField("constraints", e.target.value)} placeholder="Fear, wound, blind spot, vow..." />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Motivation</label>
        <textarea className="field-textarea" value={data.motivation} onChange={e => updateField("motivation", e.target.value)} placeholder="What does this character want badly enough to distort behavior?" />
      </div>

      <div className="modal-grid modal-grid-two">
        <div className="field-group">
          <label className="field-label">Physiology</label>
          <textarea className="field-textarea" value={data.physiology} onChange={e => updateField("physiology", e.target.value)} placeholder="Physical markers, movement, visible stress tells..." />
        </div>
        <div className="field-group">
          <label className="field-label">Psychology</label>
          <textarea className="field-textarea" value={data.psychology} onChange={e => updateField("psychology", e.target.value)} placeholder="Internal logic, contradiction, defense mechanism..." />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Dossier Notes</label>
        <textarea className="field-textarea" value={data.description} onChange={e => updateField("description", e.target.value)} placeholder="Observed detail, backstory fragments, tension with other cast..." />
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        {char?.id ? <button className="btn btn-danger" onClick={() => onDelete(char.id)}>Delete</button> : null}
        <button className="btn btn-primary" onClick={handleSave}>Save Dossier</button>
      </div>
    </ModalFrame>
  );
}

export function SceneModal({ scene, onSave, onClose, onDelete }) {
  const [data, setData] = useState(() => normalizeSceneInput(scene));

  useEffect(() => {
    setData(normalizeSceneInput(scene));
  }, [scene]);

  const updateField = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({
      ...scene,
      ...data
    });
  };

  return (
    <ModalFrame
      title={scene?.id ? "Scene brief" : "New scene brief"}
      subtitle="This is the control surface for intent, causality, and preflight readiness."
      onClose={onClose}
      maxWidth={960}
    >
      <div className="modal-grid modal-grid-two">
        <div className="field-group">
          <label className="field-label">Scene Title</label>
          <input className="field-input" value={data.title} onChange={e => updateField("title", e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">Chapter Number</label>
          <input className="field-input" type="number" value={data.chapter} onChange={e => updateField("chapter", Number.parseInt(e.target.value || "1", 10))} />
        </div>
      </div>

      <div className="modal-grid modal-grid-three">
        <div className="field-group">
          <label className="field-label">Location Lock</label>
          <input className="field-input" value={data.location} onChange={e => updateField("location", e.target.value)} placeholder="Where can this scene happen?" />
        </div>
        <div className="field-group">
          <label className="field-label">Story Time</label>
          <input className="field-input" value={data.time} onChange={e => updateField("time", e.target.value)} placeholder="When does it happen?" />
        </div>
        <div className="field-group">
          <label className="field-label">Scene Status</label>
          <select className="field-select" value={data.status} onChange={e => updateField("status", e.target.value)}>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="polish">Polish</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      <div className="modal-grid modal-grid-two">
        <div className="field-group">
          <label className="field-label">Characters Present</label>
          <input className="field-input" value={data.chars} onChange={e => updateField("chars", e.target.value)} placeholder="Comma-separated cast in scene" />
        </div>
        <div className="field-group">
          <label className="field-label">Planted Objects / Props</label>
          <input className="field-input" value={data.objects} onChange={e => updateField("objects", e.target.value)} placeholder="Watch, coffee cup, knife, ledger..." />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Function Type</label>
        <select className="field-select" value={data.causalityType} onChange={e => updateField("causalityType", e.target.value)}>
          <option value="linear">Linear</option>
          <option value="reversal">Reversal</option>
          <option value="reveal">Reveal</option>
          <option value="set-piece">Set-piece</option>
          <option value="confrontation">Confrontation</option>
          <option value="transition">Transition</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">Scene Summary</label>
        <textarea className="field-textarea" value={data.summary} onChange={e => updateField("summary", e.target.value)} placeholder="One sharp sentence for what the scene actually does." />
      </div>

      <div className="modal-grid modal-grid-two">
        <div className="field-group">
          <label className="field-label">Causality</label>
          <textarea className="field-textarea" value={data.causality} onChange={e => updateField("causality", e.target.value)} placeholder="Why does this scene happen now?" />
        </div>
        <div className="field-group">
          <label className="field-label">Required Output</label>
          <textarea className="field-textarea" value={data.output} onChange={e => updateField("output", e.target.value)} placeholder="What must change before the next scene?" />
        </div>
      </div>

      <div className="modal-grid modal-grid-two">
        <div className="field-group">
          <label className="field-label">Stakes</label>
          <textarea className="field-textarea" value={data.stakes} onChange={e => updateField("stakes", e.target.value)} placeholder="What failure costs emotionally, narratively, or practically?" />
        </div>
        <div className="field-group">
          <label className="field-label">Scene Notes</label>
          <textarea className="field-textarea" value={data.notes} onChange={e => updateField("notes", e.target.value)} placeholder="Continuity notes, voice risks, unresolved pressure..." />
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        {scene?.id ? <button className="btn btn-danger" onClick={() => onDelete(scene.id)}>Delete</button> : null}
        <button className="btn btn-primary" onClick={handleSave}>Save Scene</button>
      </div>
    </ModalFrame>
  );
}

import { useState, useEffect } from "react";

export function CharModal({ char, onSave, onClose, onDelete }) {
  const [data, setData] = useState(char || { name: "", archetype: "", motivation: "", Physiology: "", Psychology: "" });
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{char ? "Edit Character" : "New Character"}</h3>
        <div className="form-group">
          <label>Name</label>
          <input value={data.name} onChange={e => setData({...data, name: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Archetype</label>
          <input value={data.archetype} onChange={e => setData({...data, archetype: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Motivation</label>
          <textarea value={data.motivation} onChange={e => setData({...data, motivation: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Physiology (Physical markers)</label>
          <textarea value={data.Physiology} onChange={e => setData({...data, Physiology: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Psychology (Internal logic)</label>
          <textarea value={data.Psychology} onChange={e => setData({...data, Psychology: e.target.value})} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          {char && <button className="btn btn-danger" onClick={() => onDelete(char.id)}>Delete</button>}
          <button className="btn btn-primary" onClick={() => onSave(data)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export function SceneModal({ scene, onSave, onClose, onDelete }) {
  const [data, setData] = useState(scene || { 
    title: "", chapter: 1, location: "", time: "", objects: "", causality: "", output: "", stakes: "", status: "draft", causalityType: "linear" 
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <h3>{scene ? "Edit Scene" : "New Scene"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label>Title</label>
            <input value={data.title} onChange={e => setData({...data, title: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Chapter</label>
            <input type="number" value={data.chapter} onChange={e => setData({...data, chapter: parseInt(e.target.value)})} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label>Location</label>
            <input value={data.location} onChange={e => setData({...data, location: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Story Time</label>
            <input value={data.time} onChange={e => setData({...data, time: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label>Function Type</label>
          <select value={data.causalityType} onChange={e => setData({...data, causalityType: e.target.value})}>
            <option value="linear">Linear (Sequential)</option>
            <option value="reversal">Reversal (Assumption Inverted)</option>
            <option value="reveal">Reveal (Information Unlocked)</option>
            <option value="set-piece">Set-Piece (Mechanical Test)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Carried Objects (Planted/Props)</label>
          <input value={data.objects} onChange={e => setData({...data, objects: e.target.value})} placeholder="e.g. Broken watch, cold coffee" />
        </div>
        <div className="form-group">
          <label>Causality (Why does this happen?)</label>
          <textarea value={data.causality} onChange={e => setData({...data, causality: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Required Output (What must change?)</label>
          <textarea value={data.output} onChange={e => setData({...data, output: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Stakes (What happens if it fails?)</label>
          <textarea value={data.stakes} onChange={e => setData({...data, stakes: e.target.value})} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          {scene && <button className="btn btn-danger" onClick={() => onDelete(scene.id)}>Delete</button>}
          <button className="btn btn-primary" onClick={() => onSave(data)}>Save</button>
        </div>
      </div>
    </div>
  );
}

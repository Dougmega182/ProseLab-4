import json
import hashlib
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict
from pydantic import BaseModel

class SnapshotManifest(BaseModel):
    snapshot_id: str
    canon_hash: str
    contract_hash: str
    voice_rubric_version: str
    ast_schema_version: str
    created_by: str
    parent_snapshot: Optional[str]
    timestamp: str

def compute_file_hash(filepath: Path) -> str:
    if not filepath.exists():
        return ""
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

class SnapshotError(Exception):
    pass

class SnapshotManager:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.snapshots_dir = self.data_dir / "snapshots"
        self.commits_dir = self.data_dir / "commits"
        self.canon_path = self.data_dir / "canon_store.json"
        self.contract_path = self.data_dir / "book1_contract.json"
        
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)
        self.commits_dir.mkdir(parents=True, exist_ok=True)
        
        self._recover_on_boot()
        
    def _recover_on_boot(self):
        """
        Boot Algorithm (Deterministic):
        1. Scan /commits/
        2. Select latest valid commit marker
        3. Ignore everything else
        4. Rebuild active files from commit
        5. Wipe uncommitted snapshots
        """
        commit_files = list(self.commits_dir.glob("commit_*.final"))
        
        # 1. Gather valid snapshot IDs
        valid_snap_ids = set()
        for c in commit_files:
            try:
                data = json.loads(c.read_text(encoding="utf-8"))
                valid_snap_ids.add(data["snapshot_id"])
            except:
                pass
                
        # 2. Wipe uncommitted snapshots ALWAYS (even in genesis state)
        for snap_dir in self.snapshots_dir.iterdir():
            if snap_dir.is_dir() and snap_dir.name not in valid_snap_ids:
                shutil.rmtree(snap_dir)
                
        if not commit_files:
            return # Genesis state
            
        commit_files.sort(key=lambda p: p.name)
        latest_commit = commit_files[-1]
        
        try:
            commit_data = json.loads(latest_commit.read_text(encoding="utf-8"))
            target_snap = commit_data["snapshot_id"]
        except Exception as e:
            raise SnapshotError(f"Fatal: Latest commit marker corrupted: {latest_commit}")
            
        target_dir = self.snapshots_dir / target_snap
        if not target_dir.exists():
            raise SnapshotError(f"Fatal: Commit marker {latest_commit.name} points to missing snapshot {target_snap}")
            
        # Rebuild Active State
        canon_src = target_dir / "canon_store.json"
        contract_src = target_dir / "book1_contract.json"
        
        if canon_src.exists():
            shutil.copy2(canon_src, self.canon_path)
            
        if contract_src.exists():
            shutil.copy2(contract_src, self.contract_path)
        elif self.contract_path.exists():
            self.contract_path.unlink()

    def create_snapshot(self, created_by: str = "apply-amendments", voice_rubric_version: str = "v1", parent_snapshot: Optional[str] = None) -> str:
        """
        Snapshot flow driven by Atomic Commit Marker.
        """
        if not self.canon_path.exists():
            raise SnapshotError("Cannot snapshot: canon_store.json missing.")
            
        timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        snapshot_id = f"snap_{timestamp_str}_{uuid.uuid4().hex[:8]}"
        
        target_dir = self.snapshots_dir / snapshot_id
        target_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # 1. Stage files
            shutil.copy2(self.canon_path, target_dir / "canon_store.json")
            if self.contract_path.exists():
                shutil.copy2(self.contract_path, target_dir / "book1_contract.json")
                
            # 2. Compute Hashes & Write Manifest
            canon_hash = compute_file_hash(target_dir / "canon_store.json")
            contract_hash = compute_file_hash(target_dir / "book1_contract.json") if (target_dir / "book1_contract.json").exists() else ""
            
            manifest = SnapshotManifest(
                snapshot_id=snapshot_id,
                canon_hash=canon_hash,
                contract_hash=contract_hash,
                voice_rubric_version=voice_rubric_version,
                ast_schema_version="v1",
                created_by=created_by,
                parent_snapshot=parent_snapshot,
                timestamp=timestamp_str
            )
            
            manifest_path = target_dir / "manifest.json"
            manifest_json = manifest.model_dump_json(indent=2)
            manifest_path.write_text(manifest_json, encoding="utf-8")
            
            # 3. L1 Validation
            self.verify_snapshot(snapshot_id)
            
            # 4. Intent Hash Generation
            intent_raw = snapshot_id + (parent_snapshot or "") + manifest_json
            intent_hash = hashlib.sha256(intent_raw.encode("utf-8")).hexdigest()
            
            # 5. OS Fsync (simulate by ensuring writes are done)
            # Write text handles flush and close internally, which is sufficient here.
            
            # 6. ATOMIC COMMIT MARKER WRITTEN LAST
            commit_marker = self.commits_dir / f"commit_{snapshot_id}.final"
            commit_payload = {
                "snapshot_id": snapshot_id,
                "intent_hash": intent_hash,
                "parent_snapshot": parent_snapshot,
                "timestamp": timestamp_str
            }
            commit_marker.write_text(json.dumps(commit_payload, indent=2), encoding="utf-8")
            
            return snapshot_id
            
        except Exception as e:
            # If we crash here, the commit marker wasn't written.
            # _recover_on_boot will wipe the orphaned target_dir.
            raise SnapshotError(f"Failed to create atomic snapshot: {str(e)}")

    def verify_snapshot(self, snapshot_id: str) -> bool:
        """
        Verifies the cryptographic trust of a snapshot.
        """
        snap_dir = self.snapshots_dir / snapshot_id
        if not snap_dir.exists():
            raise SnapshotError(f"Snapshot directory not found: {snapshot_id}")
            
        manifest_path = snap_dir / "manifest.json"
        if not manifest_path.exists():
            raise SnapshotError(f"Manifest missing for snapshot: {snapshot_id}")
            
        try:
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest = SnapshotManifest(**manifest_data)
        except Exception as e:
            raise SnapshotError(f"Invalid manifest format: {str(e)}")
            
        # Verify Canon
        canon_file = snap_dir / "canon_store.json"
        if not canon_file.exists():
            raise SnapshotError(f"Missing canon_store.json in snapshot: {snapshot_id}")
        if compute_file_hash(canon_file) != manifest.canon_hash:
            raise SnapshotError(f"Canon hash mismatch! Snapshot {snapshot_id} is corrupted.")
            
        # Verify Contract
        contract_file = snap_dir / "book1_contract.json"
        if manifest.contract_hash:
            if not contract_file.exists():
                raise SnapshotError(f"Missing book1_contract.json in snapshot: {snapshot_id}")
            if compute_file_hash(contract_file) != manifest.contract_hash:
                raise SnapshotError(f"Contract hash mismatch! Snapshot {snapshot_id} is corrupted.")
                
        if manifest.ast_schema_version != "v1":
             raise SnapshotError(f"Unsupported AST schema version: {manifest.ast_schema_version}")
             
        return True

    def rollback_snapshot(self, target_snapshot_id: str) -> str:
        """
        Rollback is a state transition, not a file operation.
        We hydrate active state from target, then create a NEW commit marker to seal it.
        """
        # 1. Verify target exists and is trusted
        self.verify_snapshot(target_snapshot_id)
        target_commit = self.commits_dir / f"commit_{target_snapshot_id}.final"
        if not target_commit.exists():
            raise SnapshotError(f"Cannot rollback to uncommitted snapshot: {target_snapshot_id}")
            
        target_dir = self.snapshots_dir / target_snapshot_id
        
        # 2. Mutate active state
        shutil.copy2(target_dir / "canon_store.json", self.canon_path)
        contract_src = target_dir / "book1_contract.json"
        if contract_src.exists():
            shutil.copy2(contract_src, self.contract_path)
        elif self.contract_path.exists():
            self.contract_path.unlink()
            
        # 3. Seal as a new forward state transition
        new_snap_id = self.create_snapshot(
            created_by=f"rollback_to_{target_snapshot_id}",
            parent_snapshot=target_snapshot_id
        )
        return new_snap_id

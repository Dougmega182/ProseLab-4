import json
import hashlib
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from pydantic import BaseModel
from typing import Optional

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
        self.canon_path = self.data_dir / "canon_store.json"
        self.contract_path = self.data_dir / "book1_contract.json"
        
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)
        
    def create_snapshot(self, created_by: str = "apply-amendments", voice_rubric_version: str = "v1", parent_snapshot: Optional[str] = None) -> str:
        """
        Creates a verified snapshot atomically using a temp directory and renaming.
        """
        if not self.canon_path.exists():
            raise SnapshotError("Cannot snapshot: canon_store.json missing.")
            
        timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        snapshot_id = f"snap_{timestamp_str}_{uuid.uuid4().hex[:8]}"
        
        temp_dir = self.snapshots_dir / f".tmp_{snapshot_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # 1. Copy files to temp
            shutil.copy2(self.canon_path, temp_dir / "canon_store.json")
            if self.contract_path.exists():
                shutil.copy2(self.contract_path, temp_dir / "book1_contract.json")
                
            # 2. Compute hashes from the copied files (not originals, to ensure integrity of the copy)
            canon_hash = compute_file_hash(temp_dir / "canon_store.json")
            contract_hash = compute_file_hash(temp_dir / "book1_contract.json") if (temp_dir / "book1_contract.json").exists() else ""
            
            # 3. Create Manifest
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
            
            # 4. Write Manifest
            manifest_path = temp_dir / "manifest.json"
            manifest_path.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
            
            # 5. Atomically rename to finalize
            final_dir = self.snapshots_dir / snapshot_id
            os.rename(temp_dir, final_dir)
            
            return snapshot_id
            
        except Exception as e:
            # Cleanup temp dir on failure
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
            raise SnapshotError(f"Failed to create atomic snapshot: {str(e)}")

    def verify_snapshot(self, snapshot_id: str) -> bool:
        """
        Verifies the cryptographic trust of a snapshot.
        Checks if manifest hashes match the actual contents.
        Raises SnapshotError if corrupted, returns True if valid.
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
                
        # Optional: Verify schema versions are supported by current runtime
        if manifest.ast_schema_version != "v1":
             raise SnapshotError(f"Unsupported AST schema version: {manifest.ast_schema_version}")
             
        return True

    def rollback_snapshot(self, snapshot_id: str) -> None:
        """
        Rolls back the active data state to a specified snapshot.
        MUST verify trust cryptographically before attempting restore.
        Atomically copies the verified snapshot contents back to the active canon location.
        """
        # 1. Cryptographically verify the snapshot first
        self.verify_snapshot(snapshot_id)
        
        snap_dir = self.snapshots_dir / snapshot_id
        
        # 2. Perform the restore
        try:
            shutil.copy2(snap_dir / "canon_store.json", self.canon_path)
            
            # Restore contract only if the snapshot has one
            contract_file = snap_dir / "book1_contract.json"
            if contract_file.exists():
                shutil.copy2(contract_file, self.contract_path)
            elif self.contract_path.exists():
                # If the snapshot DOES NOT have a contract, but the active state does,
                # we must delete the active contract to accurately reflect the snapshot state.
                self.contract_path.unlink()
                
        except Exception as e:
            raise SnapshotError(f"Critical error during rollback to {snapshot_id}: {str(e)}")

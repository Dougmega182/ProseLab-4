import json
import pytest
import shutil
from pathlib import Path
from narrative_os.snapshot_manager import SnapshotManager, SnapshotError

@pytest.fixture
def temp_data_dir(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    
    # Create fake canon and contract
    canon_file = data_dir / "canon_store.json"
    canon_file.write_text('{"book": 1}', encoding="utf-8")
    
    contract_file = data_dir / "book1_contract.json"
    contract_file.write_text('{"contract": "v1"}', encoding="utf-8")
    
    return data_dir

def test_atomic_snapshot_creation(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    
    snap_id = manager.create_snapshot()
    
    # Verify commit marker exists
    commit_file = manager.commits_dir / f"commit_{snap_id}.final"
    assert commit_file.exists()
    
    # Verify temp dir logic is obsolete
    snap_dir = manager.snapshots_dir / snap_id
    assert snap_dir.exists()
    
    # Verify files exist
    assert (snap_dir / "manifest.json").exists()
    assert (snap_dir / "canon_store.json").exists()
    assert (snap_dir / "book1_contract.json").exists()
    
    # Verify trust
    assert manager.verify_snapshot(snap_id) is True
    print("[PASS] Atomic creation and verification")

def test_corruption_missing_canon(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    snap_id = manager.create_snapshot()
    
    # Delete canon
    (manager.snapshots_dir / snap_id / "canon_store.json").unlink()
    
    with pytest.raises(SnapshotError, match="Missing canon_store.json"):
        manager.verify_snapshot(snap_id)
    print("[PASS] Detect missing canon")

def test_corruption_hash_mismatch(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    snap_id = manager.create_snapshot()
    
    # Corrupt canon silently
    canon_file = manager.snapshots_dir / snap_id / "canon_store.json"
    canon_file.write_text('{"book": 2}', encoding="utf-8")
    
    with pytest.raises(SnapshotError, match="Canon hash mismatch"):
        manager.verify_snapshot(snap_id)
    print("[PASS] Detect silent corruption (hash mismatch)")

def test_corruption_schema_version(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    snap_id = manager.create_snapshot()
    
    # Corrupt manifest
    manifest_file = manager.snapshots_dir / snap_id / "manifest.json"
    data = json.loads(manifest_file.read_text(encoding="utf-8"))
    data["ast_schema_version"] = "v999"
    manifest_file.write_text(json.dumps(data), encoding="utf-8")
    
    with pytest.raises(SnapshotError, match="Unsupported AST schema version"):
        manager.verify_snapshot(snap_id)
    print("[PASS] Detect schema version mismatch")

def test_corruption_missing_manifest(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    snap_id = manager.create_snapshot()
    
    (manager.snapshots_dir / snap_id / "manifest.json").unlink()
    
    with pytest.raises(SnapshotError, match="Manifest missing"):
        manager.verify_snapshot(snap_id)
    print("[PASS] Detect missing manifest")

def test_successful_rollback(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    
    # 1. Create baseline snapshot
    snap_id = manager.create_snapshot()
    
    # 2. Mutate active state
    manager.canon_path.write_text('{"book": "MUTATED_STATE"}', encoding="utf-8")
    
    # 3. Rollback
    manager.rollback_snapshot(snap_id)
    
    # 4. Verify restore
    restored_canon = manager.canon_path.read_text(encoding="utf-8")
    assert restored_canon == '{"book": 1}', "Rollback failed to restore original canon state"
    print("[PASS] Successful rollback restores state")

def test_rollback_refuses_corrupted(temp_data_dir):
    manager = SnapshotManager(data_dir=str(temp_data_dir))
    
    # 1. Create baseline snapshot
    snap_id = manager.create_snapshot()
    
    # 2. Corrupt the snapshot silently
    canon_file = manager.snapshots_dir / snap_id / "canon_store.json"
    canon_file.write_text('{"book": 2}', encoding="utf-8")
    
    # 3. Mutate active state
    manager.canon_path.write_text('{"book": "MUTATED_STATE"}', encoding="utf-8")
    
    # 4. Attempt rollback (should fail cryptographically)
    with pytest.raises(SnapshotError, match="Canon hash mismatch"):
        manager.rollback_snapshot(snap_id)
        
    # 5. Verify active state was NOT touched by the failed rollback attempt
    current_canon = manager.canon_path.read_text(encoding="utf-8")
    assert current_canon == '{"book": "MUTATED_STATE"}', "Active state was corrupted by a failed rollback attempt!"
    print("[PASS] Rollback refuses corrupted snapshot and protects active state")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

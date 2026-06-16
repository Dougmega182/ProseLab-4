import pytest
import os
import shutil
import json
from pathlib import Path
from unittest.mock import patch
from narrative_os.snapshot_manager import SnapshotManager, SnapshotError

@pytest.fixture
def manager(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    canon_file = data_dir / "canon_store.json"
    canon_file.write_text('{"book": 1}', encoding="utf-8")
    contract_file = data_dir / "book1_contract.json"
    contract_file.write_text('{"contract": "v1"}', encoding="utf-8")
    return SnapshotManager(data_dir=str(data_dir))

def test_crash_before_commit_marker(manager):
    original_canon = manager.canon_path.read_text(encoding="utf-8")
    
    # Simulate a crash right as the commit marker is about to be written
    with patch("pathlib.Path.write_text", side_effect=RuntimeError("Process Death during COMMIT_WRITE")):
        with pytest.raises(SnapshotError, match="Process Death"):
            manager.create_snapshot()
            
    # Active state untouched
    assert manager.canon_path.read_text(encoding="utf-8") == original_canon
    
    # Commit marker does NOT exist
    assert len(list(manager.commits_dir.glob("*.final"))) == 0
    
    # The snapshot directory exists (orphaned)
    orphans = list(manager.snapshots_dir.glob("snap_*"))
    assert len(orphans) == 1
    
    # Simulate a reboot, which should wipe the orphaned snapshot
    boot_manager = SnapshotManager(data_dir=str(manager.data_dir))
    
    assert len(list(boot_manager.snapshots_dir.glob("snap_*"))) == 0, "Orphaned snapshot was not wiped on boot!"
    print("[PASS] Crash before commit marker safely aborts and wipes orphan on boot")

def test_successful_boot_hydration(manager):
    # Create a valid snapshot
    snap_id = manager.create_snapshot()
    
    # Corrupt the active state massively
    manager.canon_path.write_text("CORRUPTED ACTIVE STATE", encoding="utf-8")
    manager.contract_path.unlink()
    
    # Simulate a reboot
    boot_manager = SnapshotManager(data_dir=str(manager.data_dir))
    
    # The boot manager should have forcefully hydrated the active state from the latest commit
    assert boot_manager.canon_path.read_text(encoding="utf-8") == '{"book": 1}'
    assert boot_manager.contract_path.read_text(encoding="utf-8") == '{"contract": "v1"}'
    print("[PASS] Boot hydration deterministically restores from latest commit marker")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

import os
import tempfile

# Must be set before `app.database` is imported by anything, so tests never
# touch the real dev database (backend/redline.db) that a running server
# might have open.
_tmp_dir = tempfile.mkdtemp(prefix="redline-test-")
os.environ["REDLINE_DB_PATH"] = os.path.join(_tmp_dir, "test.db")

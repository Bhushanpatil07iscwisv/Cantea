"""Serve the existing API and built React website together, without cross-origin requests."""
from pathlib import Path
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from app import app as api

DIST = Path(__file__).resolve().parent.parent / 'web' / 'dist'
if not (DIST / 'index.html').is_file():
    raise RuntimeError('Website build missing. Run REBUILD_WEBSITE.bat, then START_CANTEA.bat.')

# All original API endpoints remain available for the existing mobile client.
# The browser uses /api; both mounts refer to the same database and route handlers.
api.mount('/', StaticFiles(directory=DIST, html=True), name='website')
app = Starlette(routes=[Mount('/api', app=api), Mount('/', app=api)])

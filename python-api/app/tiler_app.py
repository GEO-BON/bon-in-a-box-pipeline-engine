"""
Titiler, told where it lives.

Its viewer pages build absolute URLs to its own endpoints out of the incoming
request, so behind nginx it needs the browser's host and scheme (see the
proxy_set_header lines on /tiler/ in http-proxy) and the prefix it is served
under, which the proxy strips from the path and so cannot be guessed here.
"""

import os

from titiler.application.main import app

app.root_path = os.environ.get("TILER_ROOT_PATH", "/tiler")

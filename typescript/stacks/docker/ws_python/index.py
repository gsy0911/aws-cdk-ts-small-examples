import socket


def application(environ, start_response):
	start_response('200 OK', [('Content-Type', 'text/plain')])

	return [f"Hello from = {socket.gethostbyname(socket.gethostname())} / {socket.gethostname()}".encode()]

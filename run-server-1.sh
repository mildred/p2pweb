#!/bin/sh

exec ./server.js -seedurl ws://localhost:8881/ws/p2pwebseeds -data data -port 1337

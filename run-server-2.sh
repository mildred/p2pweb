#!/bin/sh -ex

exec ./server.js -seedurl ws://localhost:8881/ws/p2pwebseeds -data data2 -port 1338

FROM node
MAINTAINER mildred

ADD . /opt/p2pweb
WORKDIR /opt/p2pweb

# install your application's dependencies
RUN npm install
RUN mkdir -p /var/lib/p2pweb/data
RUN mkdir -p /var/cache/p2pweb

# replace this with your application's default port
EXPOSE 8888/tcp 8888/udp

VOLUME /var/lib/p2pweb
VOLUME /var/cache/p2pweb

# replace this with your main "server" script file
CMD [ "node", "server-cli.js", "-port", "8888", "-data", "/var/lib/p2pweb/data" ]

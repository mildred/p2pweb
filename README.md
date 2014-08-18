P2P Web
=======

P2PWeb is a project that aims at replacing the traditional websites with P2PWebSites. These have the advantage of being completely distributed over the network. There is no central point of failure and there is no other way to shut down a site than shutting down all nodes that replicates it.

Unlike [Freenet](https://freenetproject.org/), replicating a P2PWebSite is a voluntary. Anyone can replicate a site, and in fact, when you visit a site, you replicate the pages you are viewing (TODO). Thus, a popular site will be faster than the others.

The protocol itself doesn't handle security. Such things are better left off to lower layers such as the [cjdns](https://github.com/cjdelisle/cjdns) protocol. Exchanged information is public anyway.

This is designed as a replacement for websites that contain mostly static content such as blogs. Complex web applications are not a target for P2PWeb. Some applications may however be implemented in pure JavaScript.

Advantages over the current Web
===============================

The design allows new applications:

* backlinks are possible using the DHT. You can then know which sites links to you (if they advertise it).
* comments in blog posts can be implemented using backlinks. Comments will be hosted by the author of the comment on his personal site and aggregated by a simple javascript function of the blog post page. Moderation is less crucial (but still possible) as the comment author takes full legal responsibility of his comment (this is the same thing with a search engine. The search engine is not responsible for the page summary it shows).
* new forms of messaging could be imagined.
* anyone could publish easily to the web

Design
======

The network is based on the kademlia DHT. This DHT is used as a public storage containing the location of each resource. The resources on the network are identified by a hash that guarantee the integrity of the resource.

A resource can either be a blob or a P2PWebSite. We can imagine other type of resources in the future. Every resource has metadata attached to it. These metadata are available as HTTP headers and are included in the resource hash (sha1).

Metadata
--------

The metadata are a subset of the HTTP headers transmitted along with the resource. To know the headers that are part of the metadata, there is a special header `x-p2pws-signed-headers` that lists them. Headers are normalized lowercase.

The metadata is included with the resource when computing its hash that identifies the resource. A serialized version of the metadata is appended at the beginning of the resource before computing the hash.

Each header is serialized in the order of `x-p2pws-signed-headers`. The header name is normalized lower case. The header value all its newlines (`"\n"`) replaced by `"\n "`. This is line continuation. The header itself is serialized this way:

    header-name ": " header-value-with-line-cont "\n"

The blobs
---------

resources can be blobs. A blob is just a piece of data. It has only one hash computed:

    blob-hash = sha1(serialized-metadata + blob-data)

On the HTTP proxy, the blobs can be accessed using a request like:

    GET /obj/faf6936528390edf5c762e7d30a99b14a4da54ba

The P2PWebSite
--------------

The P2PWebSite is a resource that links to other resource. It is also a special file format. Look at [js/signedheader.js](js/signedheader.js) for more information on the format itself.

A site is signed by a private key that the author(s) keep to themselves. The public key is available at the beginning of the file. A file has generally many versions or revisions. Each of them are signed using the private key. Once signed, a revision cannot be changed.

Each site revision contains a list of paths. For each path, there is a list of header override and the hash of a linked resource. The file is append-only (the new revisions are put at the end of the file).

Contrary to a blob, a site has many hash ids. One for each revision, and one for the last revision that may be unsigned (generally that's because you are the editor). When accessed as a blob for any of these IDs, the latest version of the file is provided.

When viewing a site, you generally visit its pages. In that case, the last signed revision is generally used (unless specified otherwise). Notes that host a site will will periodically check for new revisions. (TODO: make this instantaneous). The HTTP requests look like:

    GET /obj/faf6936528390edf5c762e7d30a99b14a4da54ba/                (the home page)
    GET /obj/faf6936528390edf5c762e7d30a99b14a4da54ba/article-1.html  (a specific page)

You can specify a revision of your choice:

    GET /obj/faf6936528390edf5c762e7d30a99b14a4da54ba,5/article-at-rev-5.html

You can also accept unsigned revisions (off by default):

    GET /obj/faf6936528390edf5c762e7d30a99b14a4da54ba,+/article-at-rev-5.html

Linking to other sites
----------------------

In order to allow absolute linking and linking to other sites, a special character `~` is introduced. This character is not allowed in site paths. Links can be:

* `~/`: links to the root of the same site
* `~faf6936528390edf5c762e7d30a99b14a4da54ba`: links to the specific blob
* `~faf6936528390edf5c762e7d30a99b14a4da54ba/`: links to the homepage of that site (at its current revision)
* `~faf6936528390edf5c762e7d30a99b14a4da54ba,*/`: links to the latest homepage of that site
* `~faf6936528390edf5c762e7d30a99b14a4da54ba,+/`: links to the latest unsigned homepage of that site (use with care)
* `~faf6936528390edf5c762e7d30a99b14a4da54ba,5/`: links to the homepage of the 5th version of that site

This works by having URLs like `/obj/SHA1/anything/~...` reduced to `/obj/...`.

Package Contents
=================

This repository contains:

* a desktop client software (implemented using node-webkit) to connect to the P2PWeb network
* a server software that talks HTTP and provides a proxy to the P2PWeb world
* a web application included in the server software identical to the desktop application

With that you can:

* create a P2PWebSite using the client software
* have your P2PWebSite hosted on a server of your choice

License
=======

This work is licenced under the GNU GPL 3.0 or any later version at your option.

Work in Progress
================

- `[ ]` To Do
- `[?]` Partially done (need checking)
- `[.]` Code is there, but untested
- `[x]` Done

TODO
----

- `[x]` fix kademlia-dht
- `[x]` fix spamming issue when no contacts are reachable (implemented a 20 second
  limit per contact when unrechable)
- `[x]` fix parsing error when contacting a disconected node. Receiving an empty
  string as a result. Should get notified the connection was unsuccessful.
  (done, reported the error differently)
- `[ ]` when failed to save a page, notify the user of the failure, and when
  returning to the text editor, make sure that the txt is not discarded.
- `[?]` when opening a link outside the interface, open in a new window by
  default (especially with node-webkit, either open in a new window or with the
  browser)
- `[ ]` don't add .meta files of the data directory to the storage
- `[ ]` when computing dependencies, files from old revisions are not included
  (SignedHeader.getFileList)
- `[ ]` show for a site the nodes that replicates it and the revision they have
- `[.]` unresponding contacts should be removed from contact list and not used
  any more except in case of absolute necessity (no other node at all).
- `[ ]` after some time dead, a contact should be removed from the contact list.
  Remove a contact if it has been dead more than it has been alive, and we are
  not offline ourselves (we have other contacts responding).
- `[x]` when refreshing a site, refresh all related resources
- `[ ]` save nodes as seeds for next time
- `[ ]` save the node id and port number for next time
- `[ ]` when saving a revision, revision list is not updated in ui
- `[ ]` add command line / environment variable options to enable some debug
  traces when necessary
    - don't need to debug the RPC all the time
    - debug RPC client and RPC server separately
    - have a few verbose levels
- `[ ]` kademlia: during a lookup, if all contacts closest to the key are dead,
  make sure we retry with non dead contacts.
- `[ ]` public address finding: don't query an url more frequently than 20s
  apart. Store the last time contacted for each url.
- `[ ]` when getting an object from the network, for whatever reason, sore it in
  cache (~/.cache for the desktop client) or in the data directory directly
  (~/.local/share) in case the object was wanted.
- `[ ]` split large files in chunks to speed up download and download them from
  multiple clients
- `[ ]` every hour, check updates for all sites we manage.

Roadmap
-------

- `[x]` make file headers (such as content-type) part of the file itself and hashed
  with the file. Define a format for it. implementation: look at all the
  occurences of sha1hex on the client side, don't put the headers and the
  content in a single string for hashing, rather call the hashng function twice.
- `[x]` add metadata for each file in the data directory to tell why it is there:
    - part of a website (tell which), information is in the website
    - viewed recently (when), it will be in a separate cache directory and use atime / mtime
    - it is a website the user created / decided to keep
- `[x]` implement website auto download for websites we created / want to keep. Try to
  have this working in almost real time. Implement notification system.
- `[.]` put p2pweb in a docker container and put an instance on the web
- `[ ]` create a website, update it locally, and check it is uploaded to the server
    - check it works outside of docker
    - check the volume of data exchanged, it shouldn't be too much
    - check for packet loops
    - check it works inside of docker
- switch ove to bittorrent protocol with extensions. Use
  http://www.rasterbar.com/products/libtorrent/
- integrate with the browser as a SOCKS4A proxy (same as Tor onion)

make it work on cjdns
---------------------

- have cjdns handle node advertisement
- handle IPv6 addresses
- handle nodes that may have multiple addresses

Backlinks
---------

The user agent, when publishing a P2PWS, can add forward links in relation to a
specific file. For example:

    Files-Merge: { '/toto.html': {
        id: ABC123,
        headers: {...},
        links: {
          [ 'alternate', object-id, site-id, path ],
          [ 'reference', XYZ567,    site-id, path ],
          ...
        }
      } }

A node responsible for publishing a site will ensure that the DHT contains the
backlinks:

    primary key:   XYZ567
    secondary key: h(backlinks-site_id-/toto.html)
    content:       ['reference', 'ABC123']

This can be used to replace a builtin-board.

Public websites or wikis
------------------------

The private key is available on the site itself. Anyone can modify it. TODO: manage concurrent editing.

Messaging
---------

On a personal website, messages can be posted encrypted, and recipients should
check regularly to see if there is a message available for decryption.

Porting over to torrent network
-------------------------------

The server software would:

- Use C++2011 and boost
- Accept [SOCKS4A](http://www.openssh.com/txt/socks4a.protocol)
  ([SOCKS4](http://www.openssh.com/txt/socks4.protocol)) connections
- Accept HTTP connection on top of SOCKS4A. HTTP Protocol implementation could
  be provided by  [pion](https://github.com/splunk/pion) although there could be
  alternatives as referenced in [this thread](http://stackoverflow.com/questions/175507/c-c-web-server-library)
- Transform the domain name xxx.bitweb to a magnet link (xxx being the
  info-hash). Feed it to [libtorrent](http://www.rasterbar.com/products/libtorrent/).
- Download as fast as possible the metadata and the requested file. Download
  other files in background. make sure that the file being requested is
  downloaded in sequential order.
- If the torrent is already downloading, make sure that the file requested is
  downloaded as fast as possible in sequential order.
- Serve the downloaded file as it is being downloaded. Do not wait for the
  torrent download to complete.

This would make a good demo. Improvement includes extnsions to bittorrent:

- store metadata with files (HTTP headers such as content type)
- store a public key with the torrent and sign the torrent
- either augment the torrent (if possible) or make a torrent reference a
  previous torrent. This would make torrent revisions.
- advertise torrent revisions on the DHT and download latest revision of a
  torrent by default. Allow mode that download specific revision.
- advertise metadata on DHT (backlinks).


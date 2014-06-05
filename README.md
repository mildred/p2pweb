TODO
====

- fix kademlia-dht

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


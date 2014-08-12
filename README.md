TODO
====

- fix kademlia-dht (done)
- fix spamming issue when no contacts are reachable (implemented a 20 second
  limit per contact when unrechable)
- fix parsing error when contacting a disconected node. Receiving an empty
  string as a result. Should get notified the connection was unsuccessful.
  (done, reported the error differently)
- when failed to save a page, notify the user of the failure, and when
  returning to the text editor, make sure that the txt is not discarded.
- when opening a link outside the interface, open in a new window by default
  (especially with node-webkit, either open in a new window or with the
  browser)

Roadmap
=======

- make file headers (such as content-type) part of the file itself and hashed
  with the file. Define a format for it. implementation: look at all the
  occurences of sha1hex on the client side, don't put the headers and the
  content in a single string for hashing, rather call the hashng function twice.
- add metadata for each file in the data directory to tell why it is there:
    - part of a website (tell which)
    - viewed recently (when)
    - it is a website the user created / decided to keep
- implement website auto download for websites we created / want to keep. Try to
  have this working in almost real time. Implement notification system.
- put p2pweb in a docker container and put an instance on the web
- create a website, update it locally, and check it is uploaded to the server

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

Messaging
---------

On a personal website, messages can be posted encrypted, and recipients should
check regularly to see if there is a message available for decryption.


# Scheduled todos

- add tests which prove that if the callable is on the queue and reregister happens with the new args/timeout/cb => the queue if not cleared will use the last
  data
- think of if i should wait for the callback to finish too if it is an async cb?
  if so => make tests proving the cb was waited for and add data to readme
- decide on the license and see the security pane on github (in the readme)
- finalize and publish the npm package (check license among other things)

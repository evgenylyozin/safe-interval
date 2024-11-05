# Scheduled todos

- plus tests:
  -- add the same function with intervals greater than single interval for safe interval
  -- add the same function for safe timeout after the timeout passed
  -- add tests for functions with many heterogeneous arguments
  -- test interval and timeout with different functions (should result in different timeouts and intervals)
  -- test map fill for interval and timeout:
  --- when the same function is added multiple times in a row
  --- when the same function is added multiple times with timeouts
  --- when different functions are added

- create real cases to test the package:
  -- single interval for registering single function many times in a row
  -- single interval for registering single function many times with intervals
  -- multiple intervals for registering multiple functions
  -- single timeout for registering single function many times in a row
  -- different timeouts for registering single function with interval greater than the timeout duration
  -- multiple timeouts for registering multiple functions

- create tests based on real cases if not already

- is the register function even needed?

- when the maps should be cleared in the interval and timeout?

- add and revise comments

- create the readme file (see the info in the notes)

- might be make some setting or other means of getting the results of the callable operations back? (async generator or something)

- finalize and publish the npm package

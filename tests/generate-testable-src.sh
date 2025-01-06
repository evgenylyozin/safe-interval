#!/bin/bash

## Copy scr folder from ../src to ./src
## but the src in tests folder can already exist
cp -r ./src ./tests/
## then for the ./tests/src/index.ts file
## remove all occasions of "//--TestsRelated--" string
## leaving other part of the string as it is
## which will lead to uncommenting the test related code
sed -i 's/\/\/--TestsRelated--//g' ./tests/src/index.ts
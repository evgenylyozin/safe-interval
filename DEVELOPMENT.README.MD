# DEVELOPMENT RELATED INFORMATION

How to get, build, develop, test, publish etc.

## How to get the repo

```bash
git clone https://github.com/evgenylyozin/safe-interval.git
```

## Initialize the repo to start developing

Prerequisite: Node v20.18.0

```bash
npm ci
```

```bash
npm i
```

## To run tests

```bash
npm run test
```

The tests are using additional data like internal caches information, this data
is not available in the production version of the package and is supplied by the
following means:

- in the source code there are some places where "//--TestsRelated--" tag is added
  this is needed to add the tests related functionality but is discarded in the build
  process as it is just a comment
- before the tests run the special script copies the src folder to the tests folder
  and then uncomments the test related parts which become the part of the testable code
- the tests then import and test generated src files (./tests/src) and use additional
  functionality present in the test.helpers.ts file

## To check types, lint, build dist files

```bash
npm run prepare-release
```

## Pre commit hook

Before commit is done, the precommit hook should run which is managed by husky
(.husky/pre-commit). It essentially fixes prettify issues, adds formatted files
to staged if any, checks types, lints, tests, builds. If all is good => the commit
happens.

It works if the prepare script was called on npm install (which should be done automatically).
If it was called it runs the husky init script which among other things changes the
source for github hooks to be in the .husky folder.

## Publishing to NPM

To publish new version of the package to npm there is a CI/CD script in the .github/workflows
folder. It is triggered only if a new release is created on the github platform.
It once again checks types, lints, tests and builds. The built files in the dist folder + a
couple other files end up being uploaded to npm. The .npmignore file is there to pick
the files due to be uploaded.

### To successfully update the npm version don't forget

- To update the version in the package.json and then
- To make the new release with this version as a tag on the github platform

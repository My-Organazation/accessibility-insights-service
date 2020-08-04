// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

var fs = require('fs');
var packageJson = require('./package.json');

const dependencies = packageJson.dependencies;
const externals = ['axe-core', 'axe-puppeteer', 'puppeteer', 'yargs', 'applicationinsights'];

const newDependencies = {};

externals.forEach((packageName) => {
    newDependencies[packageName] = dependencies[packageName];
});

const newPackageJson = {
    ...packageJson,
    scripts: {},
    dependencies: newDependencies,
    devDependencies: {},
};

fs.writeFileSync('./dist/package.json', JSON.stringify(newPackageJson));

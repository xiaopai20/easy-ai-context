const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');
const sharedDir = path.join(rootDir, 'packages', 'shared');
const sharedDist = path.join(sharedDir, 'dist');
const sharedPkg = path.join(sharedDir, 'package.json');

const targetDir = path.join(__dirname, '..', 'dist', 'node_modules', '@context', 'shared');
const targetDist = path.join(targetDir, 'dist');
const targetNodeModules = path.join(__dirname, '..', 'dist', 'node_modules');
const rootNodeModules = path.join(rootDir, 'node_modules');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function readPackageJson(packageDir) {
  const pkgPath = path.join(packageDir, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function copyPackage(packageName, visited = new Set()) {
  if (visited.has(packageName)) {
    return;
  }
  visited.add(packageName);

  const packagePath = path.join(rootNodeModules, packageName);
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Dependency "${packageName}" not found in ${rootNodeModules}. Run npm install at repo root.`);
  }

  const targetPath = path.join(targetNodeModules, packageName);
  ensureDir(path.dirname(targetPath));
  copyDir(packagePath, targetPath);

  const pkg = readPackageJson(packagePath);
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.optionalDependencies || {}),
  };

  for (const depName of Object.keys(dependencies)) {
    copyPackage(depName, visited);
  }
}

if (!fs.existsSync(sharedDist)) {
  throw new Error(`Shared dist not found at ${sharedDist}. Build @context/shared first.`);
}

ensureDir(targetDist);
copyFile(sharedPkg, path.join(targetDir, 'package.json'));
copyDir(sharedDist, targetDist);

// Ensure shared runtime dependency is bundled for Lambda.
copyPackage('aws-jwt-verify');

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const packageJsonPath = path.resolve('package.json');
const originalPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

function publish(name) {
  console.log(`\n📦 Preparing to publish: ${name}...`);
  
  // Update name in package.json
  const currentJson = { ...originalPackageJson, name };
  fs.writeFileSync(packageJsonPath, JSON.stringify(currentJson, null, 2));

  try {
    // Run npm publish
    // Note: --access public is required for scoped packages
    execSync('npm publish --access public', { stdio: 'inherit' });
    console.log(`✅ Successfully published ${name}`);
  } catch (error) {
    console.error(`❌ Failed to publish ${name}: ${error.message}`);
  }
}

try {
  // 1. Build project
  console.log('🏗️ Building project...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Publish scoped version
  publish('@anovise/docsgrep');

  // 3. Publish unscoped version
  publish('docsgrep');

} finally {
  // Always restore original package.json
  console.log('\n🔄 Restoring original package.json...');
  fs.writeFileSync(packageJsonPath, JSON.stringify(originalPackageJson, null, 2));
}

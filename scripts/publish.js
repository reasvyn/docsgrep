import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const packageJsonPath = path.resolve('package.json');
const originalPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')); // docsgrep-ignore

function publish(name) {
  console.log(`\n📦 Preparing to publish: ${name}...`); // docsgrep-ignore
  
  const currentJson = { ...originalPackageJson, name };
  fs.writeFileSync(packageJsonPath, JSON.stringify(currentJson, null, 2)); // docsgrep-ignore

  try {
    execSync('npm publish --access public', { stdio: 'inherit' });
    console.log(`✅ Successfully published ${name}`); // docsgrep-ignore
  } catch (error) {
    console.error(`❌ Failed to publish ${name}: ${error.message}`); // docsgrep-ignore
  }
}

try {
  console.log('🏗️ Building project...'); // docsgrep-ignore
  execSync('npm run build', { stdio: 'inherit' });

  publish('docsgrep');

} finally {
  console.log('\n🔄 Restoring original package.json...'); // docsgrep-ignore
  fs.writeFileSync(packageJsonPath, JSON.stringify(originalPackageJson, null, 2)); // docsgrep-ignore
}

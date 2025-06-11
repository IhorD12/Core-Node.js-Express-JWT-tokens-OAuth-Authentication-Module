// scripts/setup.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const envExamplePath = path.join(projectRoot, '.env.example');
const envPath = path.join(projectRoot, '.env');

console.log('Starting project setup...');

// 1. Install dependencies
try {
  console.log('\nRunning npm install...');
  execSync('npm install', { stdio: 'inherit', cwd: projectRoot });
  console.log('Dependencies installed successfully.');
} catch (error) {
  console.error('\nFailed to install dependencies:', error.message);
  process.exit(1);
}

// 2. Copy .env.example to .env if .env does not exist
if (!fs.existsSync(envPath)) {
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('\n.env file created successfully from .env.example.');
    console.log(
      'IMPORTANT: Please review and update the .env file with your specific credentials and secrets.'
    );
  } catch (error) {
    console.error('\nFailed to create .env file:', error.message);
    console.warn('Please manually copy .env.example to .env and configure it.');
  }
} else {
  console.log('\n.env file already exists. Skipping creation.');
  console.log('Please ensure your existing .env file is correctly configured.');
}

// 3. Print next-step instructions
console.log('\n--- Next Steps ---');
console.log('1. Configure your OAuth provider credentials and JWT_SECRET in the .env file.');
console.log('   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
console.log('   - FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET');
console.log('   - JWT_SECRET (a long, random string)');
console.log('2. Start the development server:');
console.log('   npm run dev');
console.log('3. Or, start the production server:');
console.log('   npm start');
console.log('4. Run tests to ensure everything is configured correctly:');
console.log('   npm test');
console.log('\nSetup complete! Happy coding!');

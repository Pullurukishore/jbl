const fs = require('fs');
const path = require('path');

/**
 * This script automatically synchronizes the frontend API URL with the port 
 * defined in the backend config.env file.
 */

const rootDir = __dirname;
const configPath = path.join(rootDir, 'kardex-node', 'config', 'config.env');
const angularDirs = [
    path.join(rootDir, 'Angular'),
    path.join(rootDir, 'kardex-node', 'public')
];

function updatePorts() {
    console.log('--- Port Synchronization Started ---');

    // 1. Read port from config.env
    if (!fs.existsSync(configPath)) {
        console.error(`Error: Config file not found at ${configPath}`);
        return;
    }

    const envContent = fs.readFileSync(configPath, 'utf8');
    const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
    
    if (!portMatch) {
        console.error('Error: Could not find PORT definition in config.env');
        return;
    }

    const newPort = portMatch[1];
    const newUrl = `http://localhost:${newPort}/api`;
    console.log(`Target Port detected: ${newPort}`);
    console.log(`Target API URL: ${newUrl}`);

    // 2. Find and update main JS files in Angular and Public folders
    angularDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.log(`Directory not found, skipping: ${dir}`);
            return;
        }

        const files = fs.readdirSync(dir);
        const mainJsFile = files.find(f => f.startsWith('main-') && f.endsWith('.js'));

        if (mainJsFile) {
            const filePath = path.join(dir, mainJsFile);
            console.log(`Processing: ${filePath}`);
            
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Regex to find existing localhost API URLs
            // Matches http://localhost:XXXX/api or http://10.X.X.X:XXXX/api
            const urlRegex = /http:\/\/(localhost|[\d\.]+):\d+\/api/g;
            
            if (urlRegex.test(content)) {
                const updatedContent = content.replace(urlRegex, newUrl);
                fs.writeFileSync(filePath, updatedContent, 'utf8');
                console.log(`Successfully updated URL in ${mainJsFile}`);
            } else {
                console.log(`No matching API URL pattern found in ${mainJsFile}`);
            }
        } else {
            console.log(`No main-*.js file found in ${dir}`);
        }
    });

    console.log('--- Synchronization Finished ---');
}

updatePorts();

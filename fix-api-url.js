const fs = require('fs');
const path = 'c:\\Users\\kisho\\OneDrive\\Desktop\\jbl\\Kardex\\Kardex\\Angular\\main-UJ34H2SA.js';
const content = fs.readFileSync(path, 'utf8');
const updatedContent = content.replace(/http:\/\/10\.132\.131\.74/g, 'http://localhost:5000');
fs.writeFileSync(path, updatedContent);
console.log('Successfully updated API URL in main JS file.');

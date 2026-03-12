const fs = require('fs');
const filePath = 'c:\\Users\\kisho\\OneDrive\\Desktop\\jbl\\Kardex\\Kardex\\Angular\\main-UJ34H2SA.js';
try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('http://10.132.131.74')) {
        console.log('Found old IP, replacing...');
        content = content.replace(/http:\/\/10\.132\.131\.74/g, 'http://localhost:5000');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Replacement successful.');
    } else {
        console.log('Old IP not found in file.');
    }
} catch (err) {
    console.error('Error:', err.message);
}

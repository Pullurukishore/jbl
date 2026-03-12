const fs = require('fs');
const files = [
    'c:\\Users\\kisho\\OneDrive\\Desktop\\jbl\\Kardex\\Kardex\\Angular\\main-UJ34H2SA.js',
    'c:\\Users\\kisho\\OneDrive\\Desktop\\jbl\\Kardex\\Kardex\\kardex-node\\public\\main-UJ34H2SA.js'
];
files.forEach(filePath => {
    try {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('http://10.132.131.74')) {
                console.log(`Found old IP in ${filePath}, replacing...`);
                content = content.replace(/http:\/\/10\.132\.131\.74/g, 'http://localhost:5000');
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Replacement successful for ${filePath}`);
            } else {
                console.log(`Old IP not found in ${filePath}`);
            }
        }
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
    }
});

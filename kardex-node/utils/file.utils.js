const { execSync } = require('child_process');
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');


exports.parseTextFile = async (fullPath) => {
    const content = fs.readFileSync(fullPath, 'utf8');
    return new Promise((resolve, reject) => {
        Papa.parse(content, {
            delimiter: "\t", // Adjust delimiter based on file format (e.g., ',' or '\t')
            header: true, // Set to `true` if the first row contains headers
            transformHeader: (header) => header.trim(),
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data);
            },
            error: (error) => {
                resolve({ isError: true, error });
            },
        });
    })
}


exports.mountNetworkDrive = async () => {
    const networkPath = '\\\\rjnfile01\\NVD_B2B\\PRD\\Nvidia_to_Jabil\\ZPBR_SUBCON_RAW_DATE_FEED';
    const driveLetter = 'Z:';
    const username = 'svcrjn_app@jabil';
    const password = 'J@bilindiapvt.ltd.';

    return new Promise(async (resolve) => {
        try {
            // Get the list of current network mappings
            const mappedDrives = await execSync(`net use`, { encoding: 'utf8' });

            // Check if the network path is already mapped
            if (mappedDrives.includes(networkPath)) {
                return resolve();
            }
            try {
                await execSync(`net use ${driveLetter} /delete`, { stdio: 'ignore' });
            }
            catch (err) {

            }
            // Map the network drive if not already mapped
            const command = `net use ${driveLetter} "${networkPath}" /user:${username} ${password}`;
            await execSync(command, { stdio: 'inherit' });
            resolve();
        } catch (err) {
            resolve({ isError: true });
        }
    });
};


exports.getLatestTxtFromNetworkDrive = async () => {
    const directoryPath = '\\\\rjnfile01\\NVD_B2B\\PRD\\Nvidia_to_Jabil\\ZPBR_SUBCON_RAW_DATE_FEED';
    try {
        const files = fs.readdirSync(directoryPath)
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                file,
                time: fs.statSync(path.join(directoryPath, file)).mtime
            }));

        if (files.length === 0) {
            return null;
        }

        const latestFile = files.reduce((latest, current) =>
            current.time > latest.time ? current : latest
        );

        return { name: latestFile.file, path: path.join(directoryPath, latestFile.file) };
    } catch (error) {
        return null;
    }
}

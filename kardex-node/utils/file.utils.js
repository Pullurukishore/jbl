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
    if (process.env.IS_OFFLINE === 'true') {
        console.log('Skipping network drive mount in offline mode');
        return;
    }
    const networkPath = process.env.NetworkDirectoryPath;
    const driveLetter = process.env.NetworkDriveLetter + ':';
    const username = process.env.NetworkDriveUsername;
    const password = process.env.NetworkDrivePassword;

    return new Promise(async (resolve) => {
        // Skip mounting if path doesn't look like a network share (e.g. for local testing)
        if (!networkPath || !networkPath.startsWith('\\\\')) {
            return resolve();
        }
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
    if (process.env.IS_OFFLINE === 'true') {
        console.log('Skipping network directory check in offline mode');
        return null;
    }
    const directoryPath = process.env.NetworkDirectoryPath;
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

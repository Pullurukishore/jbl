const { exec } = require('child_process');
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

let lastMountCheck = 0;
let isDriveMounted = false;

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

    // Skip mounting if path doesn't look like a network share (e.g. for local testing)
    if (!networkPath || !networkPath.startsWith('\\\\')) {
        return;
    }

    // Cache check: avoid running 'net use' on every single scan if verified within last 5 minutes
    const now = Date.now();
    if (isDriveMounted && (now - lastMountCheck < 300000)) {
        return;
    }

    return new Promise((resolve) => {
        exec('net use', { encoding: 'utf8' }, (err, stdout) => {
            if (!err && stdout && stdout.includes(networkPath)) {
                isDriveMounted = true;
                lastMountCheck = now;
                return resolve();
            }

            // If not mapped, map it asynchronously
            const command = `net use ${driveLetter} "${networkPath}" /user:${username} ${password}`;
            exec(command, (mapErr) => {
                if (mapErr) {
                    resolve({ isError: true, error: mapErr });
                } else {
                    isDriveMounted = true;
                    lastMountCheck = now;
                    resolve();
                }
            });
        });
    });
};


exports.getLatestTxtFromNetworkDrive = async () => {
    if (process.env.IS_OFFLINE === 'true') {
        console.log('Skipping network directory check in offline mode');
        return null;
    }
    const directoryPath = process.env.NetworkDirectoryPath;
    try {
        if (!fs.existsSync(directoryPath)) {
            return null;
        }
        const fileNames = await fs.promises.readdir(directoryPath);
        const txtFiles = fileNames.filter(file => file.endsWith('.txt'));

        if (txtFiles.length === 0) {
            return null;
        }

        const filesWithStats = await Promise.all(
            txtFiles.map(async (file) => {
                try {
                    const stat = await fs.promises.stat(path.join(directoryPath, file));
                    return { file, time: stat.mtimeMs };
                } catch {
                    return null;
                }
            })
        );

        const validFiles = filesWithStats.filter(Boolean);
        if (validFiles.length === 0) {
            return null;
        }

        const latestFile = validFiles.reduce((latest, current) =>
            current.time > latest.time ? current : latest
        );

        return { name: latestFile.file, path: path.join(directoryPath, latestFile.file) };
    } catch (error) {
        return null;
    }
}

const fs = require('fs');
const path = require('path');

/**
 * Resolves the Error and Success directories associated with an IN directory.
 * E.g., if inDir is ".../text-file/put/IN" or ".../text-file/put/in",
 * parent is ".../text-file/put".
 * Checks for directories: Error, error, ERR, err.
 */
function resolveKardexDirectories(inDir) {
    if (!inDir || !fs.existsSync(inDir)) {
        return { inDir, errorDir: null, successDir: null };
    }

    // Check if an explicit error path is provided in config/env
    const explicitErrorPath = process.env.Put_Error_File_Path || process.env.Pick_Error_File_Path || process.env.Kardex_Error_Path;
    if (explicitErrorPath && fs.existsSync(explicitErrorPath)) {
        return { inDir, parentDir: path.dirname(inDir), errorDir: explicitErrorPath, successDir: null };
    }

    const parentDir = path.dirname(inDir);

    // Look for error folder dynamically in parent of configured inDir
    const candidatesError = ['Error', 'error', 'ERR', 'err'];
    let errorDir = null;
    for (const name of candidatesError) {
        const p = path.join(parentDir, name);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
            errorDir = p;
            break;
        }
    }

    // Look for success folder dynamically in parent of configured inDir
    const candidatesSuccess = ['Success', 'success', 'OK', 'ok', 'Archive', 'archive'];
    let successDir = null;
    for (const name of candidatesSuccess) {
        const p = path.join(parentDir, name);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
            successDir = p;
            break;
        }
    }

    return { inDir, parentDir, errorDir, successDir };
}

/**
 * Watches the IN and Error folders after writing an order file to Kardex.
 * Checks whether:
 *  1. An error file appeared in errorDir (e.g., <baseName>.err or <baseName>.txt) -> Kardex rejected it!
 *  2. The file in inDir disappeared and NO error file exists in errorDir -> Kardex accepted it!
 *  3. Timeout reached -> Kardex has not picked it up yet (queued in IN).
 *
 * @param {Object} options
 * @param {string} options.inFilePath - Full path to file in IN folder
 * @param {string} options.fileName - File name (e.g. PUT_BIN-V0001_10_12345.txt)
 * @param {number} [options.timeoutMs=6500] - Total wait time in ms
 * @param {number} [options.pollIntervalMs=500] - Poll interval in ms
 * @returns {Promise<{ status: 'ACCEPTED' | 'REJECTED' | 'QUEUED', message: string, errorFile?: string, errorDetails?: string }>}
 */
async function waitForKardexResponse({ inFilePath, fileName, timeoutMs = 6500, pollIntervalMs = 500 }) {
    if (!inFilePath || !fileName) {
        return { status: 'ACCEPTED', message: 'No file path to watch.' };
    }

    const inDir = path.dirname(inFilePath);
    const { errorDir } = resolveKardexDirectories(inDir);
    const baseName = path.basename(fileName, path.extname(fileName));

    const startTime = Date.now();

    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;

            // 1. Check if error file exists in errorDir
            if (errorDir && fs.existsSync(errorDir)) {
                try {
                    const errorFiles = fs.readdirSync(errorDir);
                    const matchingErr = errorFiles.find(f => {
                        const fBase = path.basename(f, path.extname(f));
                        return fBase === baseName || f === `${baseName}.err` || f.startsWith(baseName);
                    });

                    if (matchingErr) {
                        clearInterval(interval);
                        let details = '';
                        try {
                            const errPath = path.join(errorDir, matchingErr);
                            details = fs.readFileSync(errPath, 'utf8').trim();
                        } catch (readErr) {
                            // ignore read error
                        }
                        return resolve({
                            status: 'REJECTED',
                            errorFile: matchingErr,
                            errorDetails: details,
                            message: 'Kardex rejected the order file. The previous order for this bin has not been processed yet in Kardex.'
                        });
                    }
                } catch (e) {
                    console.warn('[KARDEX WATCHER] Error scanning errorDir:', e.message);
                }
            }

            // 2. Check if file in IN was picked up by Kardex
            const inExists = fs.existsSync(inFilePath);
            if (!inExists) {
                // Wait one more tick (500ms) to ensure Kardex didn't simultaneously write an error file
                clearInterval(interval);
                setTimeout(() => {
                    if (errorDir && fs.existsSync(errorDir)) {
                        try {
                            const errorFiles = fs.readdirSync(errorDir);
                            const matchingErr = errorFiles.find(f => {
                                const fBase = path.basename(f, path.extname(f));
                                return fBase === baseName || f === `${baseName}.err` || f.startsWith(baseName);
                            });
                            if (matchingErr) {
                                return resolve({
                                    status: 'REJECTED',
                                    errorFile: matchingErr,
                                    message: 'Kardex rejected the order file. The previous order for this bin has not been processed yet in Kardex.'
                                });
                            }
                        } catch (e) {}
                    }
                    return resolve({
                        status: 'ACCEPTED',
                        message: 'Kardex picked up and accepted the order.'
                    });
                }, 500);
                return;
            }

            // 3. Check timeout
            if (elapsed >= timeoutMs) {
                clearInterval(interval);
                return resolve({
                    status: 'QUEUED',
                    message: 'Order dispatched to Kardex IN folder. Kardex service is processing the queue.'
                });
            }
        }, pollIntervalMs);
    });
}

module.exports = {
    resolveKardexDirectories,
    waitForKardexResponse
};

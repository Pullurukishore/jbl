const fs = require('fs');

function updateFile(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    const funcRegex = /async function createAndSendLog\(log, res\) \{[\s\S]*?return saved;\s*\}/;
    const replacement = `async function createAndSendLog(log, res) {
    let saved = null;
    try {
        saved = await db.log.create(log);
    } catch (dbErr) {
        if (log?.message && typeof log.message === 'string') {
            try {
                saved = await db.log.create({
                    ...log,
                    message: log.message.slice(0, 250)
                });
            } catch (e) {
                console.error('Failed to persist log in DB:', e.message);
            }
        }
    }
    const payload = {
        ...log,
        ...(saved ? saved.get() : {}),
        message: log.message,
        completed: true
    };
    res.write("data: " + JSON.stringify(payload) + "\\n\\n");
    if (typeof res.flush === 'function') res.flush();
    return saved || { id: null, ...log };
}`;

    if (funcRegex.test(code)) {
        code = code.replace(funcRegex, replacement);
        fs.writeFileSync(filePath, code, 'utf8');
        console.log('Successfully updated: ' + filePath);
    } else {
        console.error('Regex match failed for: ' + filePath);
    }
}

updateFile('kardex-node/controllers/put.js');
updateFile('kardex-node/controllers/pick.js');


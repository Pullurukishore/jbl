const fs = require('fs');
const filePath = 'c:/Users/kisho/OneDrive/Desktop/jbl/Kardex/Kardex/kardex-node/controllers/put.js';

let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

const oldMsgBlock = `        logs.push(await createAndSendLog({
            entity_number: birthProcess?.SerialNumber,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: \`File \${genFileName} generated and Serial Number processed successfully.\`,
            success: true,
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));`;

const newMsgBlock = `        const successMessage = isBinScan
            ? \`Serial Number \${birthProcess?.SerialNumber} verified and allocated to Bin \${req.query.hu_id}.\`
            : \`File \${newFile?.name || ''} generated and Serial Number processed successfully.\`;

        logs.push(await createAndSendLog({
            entity_number: birthProcess?.SerialNumber,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: successMessage,
            success: true,
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));`;

if (!content.includes(oldMsgBlock)) {
    console.error('Could not find oldMsgBlock in put.js');
    process.exit(1);
}

content = content.replace(oldMsgBlock, newMsgBlock);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed genFileName ReferenceError in put.js');


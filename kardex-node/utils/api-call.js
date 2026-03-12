const axios = require('axios');
const soap = require('soap');

let client;
initializeSoapClient();

// Initialize SOAP client at startup

async function initializeSoapClient() {
    return new Promise(async (resolve, reject) => {
        try {
            client = await soap.createClientAsync(`${process.env.ClientTISBaseSoapUrl}${process.env.KanbanApiEndpoint}?WSDL`);
            resolve(client);
        }
        catch (err) {
            resolve(null);
        }
    });
}


async function getSoapClient() {
    return new Promise(async (resolve, reject) => {
        if (!client) {
            try {
                client = await initializeSoapClient();
                resolve(client);
            } catch (error) {
                resolve(null);
            }
        }
        else {
            resolve(client);
        }
    });
}

exports.getPVStatusCheck = async (serialNumber, processName) => {
    const clientTest = await getSoapClient();
    if (!clientTest) {
        return { isError: true, error: { message: 'Cannot connect to soap client.' } }
    }
    const bodyObject = {
        CustomerName: process.env.TISCustomer,
        Division: process.env.TISDivision,
        SerialNumber: serialNumber,
        AssemblyNumber: '',
        TesterName: processName,
        ProcessStep: processName,
    };

    return new Promise(async (resolve, reject) => {
        //return resolve('PASS');
        clientTest.OKToTestAsync(bodyObject).then((response) => {
            resolve(response[0]?.OKToTestResult);
        })
            .catch((error) => {
                resolve({ isError: true, error })
            })
    })
}

exports.updateBoardHistory = async (data) => {
    const clientTest = await getSoapClient();
    if (!clientTest) {
        return { isError: true, error: { message: 'Cannot connect to soap client.' } }
    }
    let testString = `S${data.serialNumber}\n` +
        `C${process.env.TISCustomer}\n` +
        `I${process.env.TISDivision}\n` +
        `N${data.processName}\n` +
        `P${data.processName}\n` +
        `O${data.userId}\n` +
        `[${data.startTime}\n` +
        `]${data.endTime}\n` +
        `T${data.result}\n`;

    const bodyObject = {
        TestData: testString,
        DataFormat: 'Generic',
    }
    return new Promise(async (resolve, reject) => {
        //return resolve('Pass');
        clientTest.ProcessTestDataAsync(bodyObject).then((response) => {
            resolve(response[0]?.ProcessTestDataResult);
        })
            .catch((error) => {
                resolve({ isError: true, error })
            })
    })
}

exports.getBoardHistory = async (serialNumber) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve, reject) => {
        axios.post(process.env.BoardHistroyApiUrl,
            {
                custId: process.env.BoardHistroyCustomerId,
                serial: serialNumber,
                useMultiPartBarCode: process.env.BoardHistroyMultiPartBarCode,
                lang: process.env.BoardHistroyMultiLang,
            }, { headers: { APIKey: process.env.BoardHistroyApiKey } }
        ).then((response) => {
            resolve(response);
        })
            .catch((error) => {
                //return resolve({ data: [{ SerialNumber: '1234', Test_Process: 'BIRTH / BIRTH', StartDateTime: new Date(), Number: 'test' }] });
                resolve({ isError: true, error })
            })
    })
}

exports.getWipBySerialNumber = async (serialNumber) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve, reject) => {
        axios.post(process.env.GetBySerialApiUrl,
            {
                custId: process.env.BoardHistroyCustomerId,
                serial: serialNumber,
                useMultiPartBarCode: process.env.GetBySerialApiMultiPartBarCode,
                lang: process.env.BoardHistroyMultiLang
            }, { headers: { APIKey: process.env.GetBySerialApiKey } }
        )
            .then((response) => {
                resolve(response);
            })
            .catch((error) => {
                //return resolve({ data: { SerialNumber: '1234', StartDateTime: new Date(), Number: 'test' } });
                resolve({ isError: true, error })
            })
    })
}
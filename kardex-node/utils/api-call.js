const axios = require('axios');
const soap = require('soap');

const API_TIMEOUT = parseInt(process.env.API_TIMEOUT_MS, 10) || 30000;

let client;
initializeSoapClient();

// Initialize SOAP client at startup
async function initializeSoapClient() {
    return new Promise(async (resolve, reject) => {
        try {
            const baseUrl = (process.env.ClientTISBaseSoapUrl || '').trim();
            const endpoint = (process.env.KanbanApiEndpoint || '').trim();
            let fullSoapUrl = baseUrl;
            if (!baseUrl.toLowerCase().includes('.asmx')) {
                fullSoapUrl = `${baseUrl}${endpoint}`;
            }
            if (!fullSoapUrl.toLowerCase().includes('?wsdl')) {
                fullSoapUrl = `${fullSoapUrl}?WSDL`;
            }
            client = await soap.createClientAsync(fullSoapUrl, { timeout: API_TIMEOUT });
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

// ==============================================================================
// 1 & 2: SOAP TIS Service Calls (TIS.asmx / http://jabil.com/GMS/MES_TIS)
// Production Endpoint: http://inrjnm0tis03/MES-TIS/TIS.asmx
// ==============================================================================

exports.getPVStatusCheck = async (serialNumber, processName) => {
    if (process.env.IS_OFFLINE === 'true') {
        return 'PASS';
    }

    const clientTest = await getSoapClient();
    if (!clientTest) {
        return { isError: true, error: { message: 'Cannot connect to soap client.' } };
    }
    const bodyObject = {
        CustomerName: process.env.TISCustomer,
        Division: process.env.TISDivision,
        SerialNumber: serialNumber,
        AssemblyNumber: '',
        TesterName: processName,
        ProcessStep: processName,
    };

    return new Promise(async (resolve) => {
        let isDone = false;
        const timer = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                resolve({ isError: true, error: { message: 'SOAP OKToTest request timeout.' } });
            }
        }, API_TIMEOUT);

        clientTest.OKToTestAsync(bodyObject).then((response) => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                resolve(response[0]?.OKToTestResult);
            }
        }).catch((error) => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                resolve({ isError: true, error });
            }
        });
    });
};

exports.updateBoardHistory = async (data) => {
    if (process.env.IS_OFFLINE === 'true') {
        return 'Pass';
    }

    const clientTest = await getSoapClient();
    if (!clientTest) {
        return { isError: true, error: { message: 'Cannot connect to soap client.' } };
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
    };
    return new Promise(async (resolve) => {
        let isDone = false;
        const timer = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                resolve({ isError: true, error: { message: 'SOAP ProcessTestData request timeout.' } });
            }
        }, API_TIMEOUT);

        clientTest.ProcessTestDataAsync(bodyObject).then((response) => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                resolve(response[0]?.ProcessTestDataResult);
            }
        }).catch((error) => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                resolve({ isError: true, error });
            }
        });
    });
};

// ==============================================================================
// 5: GetBoardData (PRODUCTION API)
// Endpoint: https://inrjnm0iis13.corp.jabil.org:8082/MESWEBAPI/Wip/GetBoardData
// ==============================================================================
exports.getBoardData = async (serialNumber) => {
    if (process.env.IS_OFFLINE === 'true') {
        return {
            data: {
                SerialNumber: serialNumber,
                Number: 'SA005157',
                CurrentlyOnHold: false,
                CurrentProcess: 'KANBAN-IN'
            }
        };
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve) => {
        const apiUrl = process.env.GetBoardDataApiUrl || process.env.BoardHistroyApiUrl;
        axios.post(apiUrl,
            {
                custId: process.env.BoardHistroyCustomerId || '41',
                serial: serialNumber,
                useMultiPartBarCode: process.env.BoardHistroyMultiPartBarCode || '0',
                lang: process.env.BoardHistroyMultiLang || '0',
            }, {
                headers: { APIKey: process.env.BoardHistroyApiKey },
                timeout: API_TIMEOUT
            }
        ).then((response) => {
            if (response && response.data && !Array.isArray(response.data)) {
                response.data = [response.data];
            }
            resolve(response);
        }).catch((error) => {
            resolve({ isError: true, error });
        });
    });
};

// ==============================================================================
// 4: GetUserByWindowsId (PRODUCTION API)
// Endpoint: https://inrjnm0iis13.corp.jabil.org:8082/MESWEBAPI/Security/GetUserByWindowsId
// ==============================================================================
exports.getUserByWindowsId = async (windowsId) => {
    if (process.env.IS_OFFLINE === 'true') {
        return {
            data: {
                WindowsId: windowsId,
                UserId: 'Admin',
                UserName: 'Administrator',
                IsActive: true
            }
        };
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve) => {
        const apiUrl = process.env.GetUserByWindowApiUrl;
        axios.post(apiUrl,
            {
                windowsId: windowsId
            }, {
                headers: { APIKey: process.env.BoardHistroyApiKey },
                timeout: API_TIMEOUT
            }
        ).then((response) => {
            resolve(response);
        }).catch((error) => {
            resolve({ isError: true, error });
        });
    });
};

// ==============================================================================
// 3: GetPanelSerializeResult (PRODUCTION API)
// Endpoint: https://inrjnm0iis13.corp.jabil.org:8082/MESWEBAPI/Test/GetPanelSerializeResult
// ==============================================================================
exports.getPanelSerializeResult = async (panelBarcode) => {
    if (process.env.IS_OFFLINE === 'true') {
        return {
            data: {
                PanelBarcode: panelBarcode,
                Result: 'PASS',
                Serials: []
            }
        };
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve) => {
        const apiUrl = process.env.GetPanelSerializeApiUrl;
        axios.post(apiUrl,
            {
                panelBarcode: panelBarcode,
                custId: process.env.BoardHistroyCustomerId || '41'
            }, {
                headers: { APIKey: process.env.BoardHistroyApiKey },
                timeout: API_TIMEOUT
            }
        ).then((response) => {
            resolve(response);
        }).catch((error) => {
            resolve({ isError: true, error });
        });
    });
};

// ==============================================================================
// OLD / REAL ENVIRONMENT (PRODUCTION) WRAPPERS - KEPT FOR FUTURE PRODUCTION USE
// ==============================================================================

// [OLD / REAL PROD] BoardHistoryReport wrapper (calls https://inrjnm0iis13.corp.jabil.org:8082/... in prod)
// Routes to GetBoardData URL configured in config.env
exports.getBoardHistory = async (serialNumber) => {
    if (process.env.IS_OFFLINE === 'true') {
        // DYNAMIC MOCK FOR REAL-TIME TEST FEEL
        try {
            const fs = require('fs');
            const path = require('path');
            const poDir = (process.env.NetworkDirectoryPath && fs.existsSync(process.env.NetworkDirectoryPath))
                ? process.env.NetworkDirectoryPath
                : path.join(__dirname, '..', 'uploads', 'files', 'source-po');
            const files = fs.readdirSync(poDir)
                .filter(f => f.endsWith('.txt'))
                .map(file => ({
                    file,
                    time: fs.statSync(path.join(poDir, file)).mtime
                }));

            if (files.length > 0) {
                const latestFileObj = files.reduce((latest, current) =>
                    current.time > latest.time ? current : latest
                );
                const latestPO = path.join(poDir, latestFileObj.file);
                const content = fs.readFileSync(latestPO, 'utf8');
                const lines = content.split('\n');
                if (lines.length > 1) {
                    const firstRow = lines[1].split('\t');
                    const headers = (lines[0] || '').split('\t').map(h => h.trim().toLowerCase());
                    let shortTextIdx = headers.indexOf('short text');
                    if (shortTextIdx === -1) shortTextIdx = 8;
                    const partNumber = (firstRow[shortTextIdx] || firstRow[0] || '').trim();
                    if (partNumber) {
                        return {
                            data: [{
                                Test_Process: 'BIRTH / BIRTH',
                                Number: partNumber,
                                StartDateTime: new Date().toISOString(),
                                SerialNumber: serialNumber
                            }]
                        };
                    }
                }
            }
        } catch (e) { }

        return {
            data: [{
                Test_Process: 'BIRTH / BIRTH',
                Number: 'SA005157',
                StartDateTime: new Date().toISOString(),
                SerialNumber: serialNumber
            }]
        };
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve) => {
        axios.post(process.env.BoardHistroyApiUrl,
            {
                custId: process.env.BoardHistroyCustomerId,
                serial: serialNumber,
                useMultiPartBarCode: process.env.BoardHistroyMultiPartBarCode,
                lang: process.env.BoardHistroyMultiLang,
            }, {
                headers: { APIKey: process.env.BoardHistroyApiKey },
                timeout: API_TIMEOUT
            }
        ).then((response) => {
            if (response && response.data) {
                if (!Array.isArray(response.data)) {
                    if (Array.isArray(response.data.data)) {
                        response.data = response.data.data;
                    } else if (Array.isArray(response.data.History)) {
                        response.data = response.data.History;
                    } else if (Array.isArray(response.data.history)) {
                        response.data = response.data.history;
                    } else if (Array.isArray(response.data.BoardHistory)) {
                        response.data = response.data.BoardHistory;
                    } else if (typeof response.data === 'object' && response.data !== null && !response.data.Message && !response.data.error) {
                        response.data = [response.data];
                    } else {
                        response.data = [];
                    }
                }
                // Normalize CurrentProcess to Test_Process if returned from GetBoardData
                if (Array.isArray(response.data)) {
                    response.data.forEach(item => {
                        if (item && !item.Test_Process && item.CurrentProcess) {
                            item.Test_Process = item.CurrentProcess;
                        }
                    });
                }
            } else {
                response = response || {};
                response.data = [];
            }
            resolve(response);
        }).catch((error) => {
            resolve({ isError: true, error });
        });
    });
};

// [OLD / REAL PROD] GetWipBySerial wrapper (calls https://inrjnm0iis13.corp.jabil.org:8082/... in prod)
// Routes to GetBoardData URL configured in config.env
exports.getWipBySerialNumber = async (serialNumber) => {
    if (process.env.IS_OFFLINE === 'true') {
        return {
            data: {
                CurrentlyOnHold: false
            }
        };
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return new Promise(async (resolve) => {
        axios.post(process.env.GetBySerialApiUrl,
            {
                custId: process.env.BoardHistroyCustomerId,
                serial: serialNumber,
                useMultiPartBarCode: process.env.GetBySerialApiMultiPartBarCode,
                lang: process.env.BoardHistroyMultiLang
            }, {
                headers: { APIKey: process.env.GetBySerialApiKey },
                timeout: API_TIMEOUT
            }
        ).then((response) => {
            if (Array.isArray(response?.data) && response.data.length > 0) {
                const first = response.data[0];
                if (first && typeof first === 'object') {
                    Object.assign(response.data, first);
                }
            }
            resolve(response);
        }).catch((error) => {
            resolve({ isError: true, error });
        });
    });
};

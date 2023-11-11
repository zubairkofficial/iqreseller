const { default: axios } = require('axios');
const express = require('express');
const xml2js = require('xml2js');
let mongoose = require('mongoose');
let SalesOrder = require('./Models/SalesOrder');
let Page = require('./Models/Page');

const uri = 'mongodb+srv://coreyd:v7j8A6zu1WNJTP6W@cluster0.ef0zi.mongodb.net/altatechnologies?retryWrites=true&w=majority';
mongoose.connect(uri).then(data => {
    console.log(`Conneced to Mongodb! Database name: ${data.connections[0].name}`);
}).catch(err => {
    console.log(`Error connecting to database. ${err}`);
});


const app = express()
const PORT = 3000;
let currentSessionToken = null;
const pageId = "6549f5951587067fed0ab814";
const sessionExpiry = 30000; // 5 Minutes
// const sessionExpiry = 10000; // 10 Seconds

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const basePath = `https://signin.iqreseller.com/`;
const apiPath = `https://api.iqreseller.com/webapi.svc/`;
const APIToken = "wkS1CBOnz8pnXQn3SyRiEVrSoJNv6FROqxTn2jJX3wwVcCy8mA+EyDvYOOWw1VXQQii7saES5l/McEX++3pTlw==";
const KanbanBase = 'https://altatech.kanbantool.com/api/v3/';
const KanbanAPI = "3WG353Z4EVT5";
let JMBoardId = 998825;

const defaultHeaders = {
    headers: {
        "Content-Type": 'application/json',
    }
}

const requestHeaders = {
    headers: {
        "Accept": '*/*',
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }
}

const getKanbanUser = () => {
    axios.get(`${KanbanBase}users/current.json?access_token=${KanbanAPI}`).then(response => {
        let boards = response.data.boards;
        let jmBoard = boards.find(b => b.name.includes("JM"));
        JMBoardId = jmBoard.id;
        console.log("JM BOard ID::", JMBoardId);
    }).catch(error => {
        console.log("Error", error);
    });
}

const getSessionToken = () => {
    let data = {
        APIToken: APIToken,
    }
    axios.post(`${ basePath }api/IntegrationAPI/Session`, data, defaultHeaders).then(async response => {
        currentSessionToken = response.data.Data;
        updateHeaders();
        updateRequestHeaders();
        getKanbanUser();
        setTimeout(async () => {
            await getSOsList();
        }, 10000);
        console.log("Token Created::", currentSessionToken);
    }).catch(error => {
        console.log(error);
    })
}

const updateHeaders = () => {
    defaultHeaders.headers["Authorization"] = `Bearer ${ currentSessionToken }`;
}

const updateRequestHeaders = () => {
    requestHeaders.headers["iqr-session-token"] = `${ currentSessionToken }`;
}

const getSOsList = async () => {
    console.log("Getting SOs List");
    let pageNo = 0;
    await Page.findOne({"_id": pageId}).then(pageData => {
        pageNo = pageData.page_no;
    }).catch(error => {
        console.log("Error", error);
    });
    if(pageNo > 0){
        console.log(`Fetching Data From Page::${ pageNo }`);
        axios.get(`${ apiPath }SO/XML/GetSOs?Page=${pageNo}&PageSize=100&SortBy=0`, requestHeaders).then(response => {
            let xmlData = response.data;
            xml2js.parseString(xmlData, async (err, result) => {
                if(err) {
                    console.error("Error parsing XML");
                    return;
                }
                let jm = result.ArrayOfSO.SO.filter(so => so.rep[0].includes("JM"));
                console.log("JM Length:: ", jm.length);
                jm.forEach(sales_order => {
                    // console.log(sales_order.SODetails);
                    // let description = sales_order.SODetails ? sales_order.SODetails[0].SODetail[0].description[0].trim() : "";
                    let rep = sales_order.rep[0];
                    let soId = sales_order.so[0];
                    let sale_date = sales_order.saledate[0];
                    SalesOrder.findOne({ soId: soId }).then(existingOrder => {
                        if (existingOrder) {
                            console.log(`Record already exists for SO ID: ${soId}`);
                        } else {
                            let so_obj = { rep, soId, sale_date };
                            SalesOrder.create(so_obj).then(data => {
                                console.log(`NEW ENTRY:: REP:: ${rep} - SALES ORDER ID:: ${soId}`);
                                let description = `Sale Date: ${sale_date}`;
                                createTask(`SO ${ soId }`, description);
                            }).catch(error => {
                                console.log("ERROR_NEW_ENTRY");
                            });
                        }
                    }).catch(error => {
                        // console.log("ERROR_FINDING_ORDER");
                        let so_obj = { rep, soId, sale_date };
                        SalesOrder.create(so_obj).then(data => {
                            console.log(`NEW ENTRY:: REP:: ${rep} - SALES ORDER ID:: ${soId}`);
                            let description = `Sale Date: ${sale_date}`;
                            createTask(`SO ${ soId }`, description);
                        }).catch(error => {
                            console.log("ERROR_NEW_ENTRY");
                        });
                    });
                });
                if(result.ArrayOfSO.SO.length === 100){
                    await Page.findByIdAndUpdate({"_id":pageId}, {"page_no": parseInt(pageNo) + 1});
                }
            });
        }).catch(error => {
            console.log("Error in request");
        });
    }
}

const createTask = (name, description) => {
    let data = JSON.stringify({
        "board_id": JMBoardId,
        "name": name,
        "description": description,
        "custom_field_1": "[\"Local\",\"Config\"]",
        "priority": 0,
        "assigned_user_id": 968957,
        "card_type_id": 12165441,
    });
    let config = {
        method: 'POST',
        maxBodyLength: Infinity,
        url: `${KanbanBase}tasks.json?access_token=${KanbanAPI}`,
        headers:{
            'Content-Type': 'application/json',
        },
        data: data
    };
    axios.request(config).then(response => {
        console.log("TASK Created");
    }).catch(error => {
        console.log("Error Creating Task");
    });
}

const deleteSession = () => {
    axios.delete(`${ basePath }api/IntegrationAPI/Session`, defaultHeaders).then(response => {
        console.log("Session Deleted");
    });
}

app.listen(PORT, () => {
    // Session Generation & Deletion
    getSessionToken();
    setInterval(() => {
        deleteSession();
        getSessionToken();
    }, sessionExpiry);
    console.log(`App is running on PORT ${ PORT }`);
});
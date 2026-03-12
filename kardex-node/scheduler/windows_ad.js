var ActiveDirectory = require('activedirectory2');
var schedule = require('node-schedule');
const db = require('../models');
var domain = ['inha-cnhs']
var rule = new schedule.RecurrenceRule();
//rule.dayOfWeek = [0, new schedule.Range(0, 6)];
//rule.hour = 16;
rule.minute = 20;


//var j = schedule.scheduleJob(rule, function () {

//}, getDomain);

function getDomain() {
    for (const d of domain) {
        getdata(d);
    }
}


async function getdata(d) {

    var url = "ldap://" + d + ".com";
    var baseDN = "dc=" + d + ",dc=com";

    var config = {
        url: url,
        baseDN: baseDN,
          username: '30005631@inha-cnhs.com',
    password: 'Month@May2022',
        attributes: {
            user: ['sAMAccountName', 'dn', 'userPrinicipalName', 'mail', 'company', 'department', 'mobile', 'title', 'telephoneNumber', 'accountExpires','displayName','employeeID']
        }
    }
    var ad = new ActiveDirectory(config);
    var opts = {
        filter: '(&(|(objectClass=user)(objectClass=person))(!(objectClass=computer))(!(objectClass=group)))',
        paged: true,
        sizeLimit: 10

    };
    ad.findUsers(opts, async function (err, result) {
        if (err) {
            console.log('ERROR: ' + JSON.stringify(err));
        }
        if (result) {
try{
let i=0;
            for (const r of result) {

console.log(++i);
console.log(r);
if(r.employeeID && r.displayName){
                const user = await db.users.findOne({
                    where: {
                        employee_id: r.employeeID
                }
                });

                if (!user) {
                    const user = await db.users.create(
                        {
                            employee_id: r.employeeID,
                            name:r.displayName,
                            email_id:r.mail,
                            password:'$2a$04$fF62YBwhhnJPjqre0PhGDuqZY316XMDZzS1VIjKdoQd2DYNHy8x1m',
                            designation:'employee',
                            isActive:'1',
                            ad_domain:d,
type:'windowsAd'
                        }
                    );
                } else {
                    const user = await db.users.update(  {
                        employee_id: r.employeeID,
                        name:r.displayName,
                        email_id:r.mail,
                        password:'$2a$04$fF62YBwhhnJPjqre0PhGDuqZY316XMDZzS1VIjKdoQd2DYNHy8x1m',
                        designation:'employee',
                        isActive:'1',
                        ad_domain:d,
type:'windowsAd'
                    }, {
                        where: {
                            id: r.employeeID
                        }
                    });
                }
}
            }
}catch(err){
console.log("hiii",err);
}
        }


        if (!result) {
            console.log('no result!');
        }
    });

}
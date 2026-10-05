function getDatabaseConfig(){
    return {
        host: "localhost",
        port: 3306,
        database: "techstore",
        username: "techstore_root",
        password: "***REDACTED***"
    };
}

module.exports = {
    getDatabaseConfig
};
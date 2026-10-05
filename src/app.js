app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        database: database.host
    });
});


app.get("/config-check", (req, res) => {
    res.json({
        database: database.database,
        adminConfigured: Boolean(***REDACTED***),
        paymentConfigured: Boolean(***REDACTED***),
        internalApiConfigured: Boolean(***REDACTED***),
    });
});


app.listen(PORT, () => {
    console.log(`API Techstore is running on port ${PORT}`);
});

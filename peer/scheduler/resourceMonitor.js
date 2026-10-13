const os = require("os");

function getResourceInfo() {
    const cpuCores = os.cpus().length;

    const totalMemoryGB = (
        os.totalmem() / (1024 ** 3)
    ).toFixed(2);

    const freeMemoryGB = (
        os.freemem() / (1024 ** 3)
    ).toFixed(2);

    const usedMemoryGB = (
        (os.totalmem() - os.freemem()) /
        (1024 ** 3)
    ).toFixed(2);

    const memoryUsagePercent = (
        ((os.totalmem() - os.freemem()) /
        os.totalmem()) * 100
    ).toFixed(1);

    return {
        cpuCores,
        totalMemoryGB,
        freeMemoryGB,
        usedMemoryGB,
        memoryUsagePercent
    };
}

function startResourceMonitor(peerInfo) {
    function updateResources() {
        const resources = getResourceInfo();

        peerInfo.cpuCores =
            resources.cpuCores;

        peerInfo.totalMemoryGB =
            resources.totalMemoryGB;

        peerInfo.freeMemoryGB =
            resources.freeMemoryGB;

        peerInfo.usedMemoryGB =
            resources.usedMemoryGB;

        peerInfo.memoryUsagePercent =
            resources.memoryUsagePercent;
    }

    // Initial resource information
    updateResources();

    // Refresh every 5 seconds
    setInterval(() => {
        updateResources();
    }, 5000);

    console.log(
        "[RESOURCE] Resource monitor started"
    );

    return {
        getResources: getResourceInfo
    };
}

module.exports = {
    getResourceInfo,
    startResourceMonitor
};

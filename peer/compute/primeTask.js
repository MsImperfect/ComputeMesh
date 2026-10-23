// ========================================
// Prime Number Task
// ========================================

function isPrime(number) {
    if (number < 2) {
        return false;
    }

    if (number === 2) {
        return true;
    }

    if (number % 2 === 0) {
        return false;
    }

    const limit = Math.sqrt(number);

    for (
        let divisor = 3;
        divisor <= limit;
        divisor += 2
    ) {
        if (number % divisor === 0) {
            return false;
        }
    }

    return true;
}


// ========================================
// Calculate Primes in a Range
// ========================================

async function calculatePrimesAsync(start, end) {
    const primes = [];
    const CHUNK_SIZE = 10000;

    for (
        let number = start;
        number <= end;
        number++
    ) {
        if (isPrime(number)) {
            primes.push(number);
        }

        if ((number - start) % CHUNK_SIZE === 0 && number !== start) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    return primes;
}

function calculatePrimes(start, end) {
    const primes = [];

    for (
        let number = start;
        number <= end;
        number++
    ) {
        if (isPrime(number)) {
            primes.push(number);
        }
    }

    return primes;
}


// ========================================
// Execute Prime Task
// ========================================

async function executePrimeTask(task) {
    const startTime = Date.now();

    const start = Number(task.start);
    const end = Number(task.end);

    if (
        !Number.isInteger(start) ||
        !Number.isInteger(end)
    ) {
        throw new Error(
            "Prime task requires integer start and end values"
        );
    }

    if (start > end) {
        throw new Error(
            "Prime task start cannot be greater than end"
        );
    }

    const primes = await calculatePrimesAsync(
        start,
        end
    );

    const executionTimeMs =
        Date.now() - startTime;

    return {
        taskId: task.taskId,
        type: "PRIME",
        start,
        end,
        primes,
        count: primes.length,
        executionTimeMs
    };
}


module.exports = {
    isPrime,
    calculatePrimes,
    calculatePrimesAsync,
    executePrimeTask
};

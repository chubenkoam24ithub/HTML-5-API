self.addEventListener('message', (e) => {
    if (e.data.command === 'start') {
        const { n, id } = e.data;
        try {
            let sum = BigInt(0);
            for (let i = 1; i <= n; i++) {
                sum += BigInt(i) * BigInt(i);
                if (i % 100000 === 0) {
                    self.postMessage({ type: 'progress', progress: (i / n) * 100, id });
                }
            }
            self.postMessage({ type: 'result', result: sum.toString(), id });
        } catch (err) {
            self.postMessage({ type: 'error', message: err.message || 'Вычисления прерваны' });
        }
    } else if (e.data.command === 'cancel') {
        self.close();
    }
});
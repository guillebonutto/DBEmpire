const test1 = (url) => {
    let qrValue = url;
    if (!/^https?:\/\//i.test(qrValue)) {
        qrValue = `https://${qrValue}`;
    }
    qrValue = qrValue.replace(/^(https?:\/\/)(?!(www\.))(tiktok\.com|instagram\.com|facebook\.com)/i, '$1www.$3');
    return qrValue;
};

const test2 = (url) => {
    let qrValue = url;
    if (!/^https?:\/\//i.test(qrValue)) {
        qrValue = `https://${qrValue}`;
    }
    qrValue = qrValue.replace(/^(https?:\/\/)(tiktok\.com|instagram\.com|facebook\.com)/i, '$1www.$2');
    return qrValue;
};

console.log('--- TEST 1 (Current in file) ---');
console.log('tiktok.com/@dbempire.007 ->', test1('tiktok.com/@dbempire.007'));
console.log('https://tiktok.com/@dbempire.007 ->', test1('https://tiktok.com/@dbempire.007'));
console.log('https://www.tiktok.com/@dbempire.007 ->', test1('https://www.tiktok.com/@dbempire.007'));

console.log('--- TEST 2 (Simplified) ---');
console.log('tiktok.com/@dbempire.007 ->', test2('tiktok.com/@dbempire.007'));
console.log('https://tiktok.com/@dbempire.007 ->', test2('https://tiktok.com/@dbempire.007'));
console.log('https://www.tiktok.com/@dbempire.007 ->', test2('https://www.tiktok.com/@dbempire.007'));

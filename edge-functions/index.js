const express = require('express');
const app = express();
const port = 9000;

// 健康檢查
app.get('/', (req, res) => {
    res.status(200).send('OK');
});

// Bettbox 訂閱入口
app.get('/sub', async (req, res) => {
    // 1. 驗證私人 KEY
    const key = req.query.key;

    if (
        !process.env.SUBSCRIPTION_KEY ||
        key !== process.env.SUBSCRIPTION_KEY
    ) {
        return res.status(404).send('Not Found');
    }

    // 2. 取得真正的訂閱地址
    const subscriptionUrl = process.env.SUBSCRIPTION_URL;

    if (!subscriptionUrl) {
        return res
            .status(500)
            .send('SUBSCRIPTION_URL is not configured');
    }

    try {
        // 3. 向真正訂閱地址發出請求
        const upstream = await fetch(subscriptionUrl, {
            method: 'GET',
            headers: {
                'User-Agent': req.headers['user-agent'] || 'mihomo',
                'Accept': '*/*'
            }
        });

        if (!upstream.ok) {
            return res
                .status(502)
                .send(`Upstream error: ${upstream.status}`);
        }

        // 4. 取得原始訂閱內容
        const body = Buffer.from(await upstream.arrayBuffer());

        // 5. 保留 Content-Type
        const contentType = upstream.headers.get('content-type');

        if (contentType) {
            res.set('Content-Type', contentType);
        } else {
            res.set('Content-Type', 'text/plain; charset=utf-8');
        }

        // 6. 保留訂閱流量資訊
        const userInfo =
            upstream.headers.get('subscription-userinfo');

        if (userInfo) {
            res.set('subscription-userinfo', userInfo);
        }

        // 不保存私人訂閱快取
        res.set('Cache-Control', 'no-store');

        // 7. 原樣返回
        return res.status(200).send(body);

    } catch (error) {
        console.error('Subscription fetch failed:', error);

        return res
            .status(502)
            .send('Failed to fetch upstream subscription');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Bettbox subscription proxy listening on port ${port}`);
});
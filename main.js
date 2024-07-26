const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');

class PokeyQuest {
    headers(token = '') {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Origin': 'https://dapp.pokequest.io',
            'Priority': 'u=1, i',
            'Referer': 'https://dapp.pokequest.io/',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async Countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            const minutes = Math.floor(i / 60);
            const remainingSeconds = i % 60;
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Waiting ${minutes} minutes and ${remainingSeconds} seconds to continue...`.yellow);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    async postToPokeyQuestAPI(data) {
        const url = 'https://api.pokey.quest/auth/login';
        const payload = {
            auth_date: data.auth_date,
            hash: data.hash,
            query_id: data.query_id,
            user: data.user
        };

        try {
            const response = await axios.post(url, payload, {
                headers: this.headers(),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`.red);
            return null;
        }
    }

    async postTapSync(token) {
        const url = 'https://api.pokey.quest/tap/sync';

        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`.red);
            return null;
        }
    }

    async postTapTap(token, count) {
        const url = 'https://api.pokey.quest/tap/tap';
        const payload = { count: count };

        try {
            const response = await axios.post(url, payload, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`.red);
            return null;
        }
    }

    readTokens() {
        const tokenFile = path.join(__dirname, 'token.json');
        if (fs.existsSync(tokenFile)) {
            return JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        }
        return {};
    }

    writeTokens(tokens) {
        const tokenFile = path.join(__dirname, 'token.json');
        fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2), 'utf8');
    }

    async getNextLevel(token) {
        const url = 'https://api.pokey.quest/poke/get-next-level';

        try {
            const response = await axios.get(url, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`.red);
            return null;
        }
    }

    async upgradeLevel(token) {
        const url = 'https://api.pokey.quest/poke/upgrade';

        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`.red);
            return null;
        }
    }

    async checkAndUpgrade(token, balance) {
        let nextLevelData = await this.getNextLevel(token);

        while (nextLevelData && nextLevelData.error_code === 'OK' && balance > nextLevelData.data.upgrade_cost) {
            this.log(`Rising up ${nextLevelData.data.name}...`.green);
            
            let upgradeResponse = await this.upgradeLevel(token);
            if (upgradeResponse && upgradeResponse.error_code === 'OK') {
                balance -= nextLevelData.data.upgrade_cost;
                nextLevelData = upgradeResponse;
            } else {
                this.log(`Upgrade failure: ${upgradeResponse ? upgradeResponse.error_code : 'No response data'}`.red);
                break;
            }
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }));
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const nangcap = await this.askQuestion('Do you want to upgrade LV? (y/n): ');
        const hoinangcap = nangcap.toLowerCase() === 'y';
        const tokens = this.readTokens();

        while (true) {
            for (let i = 0; i < userData.length; i++) {
                const queryId = userData[i];
                const data = this.extractUserData(queryId);
                let token = tokens[i + 1];

                if (!token) {
                    const apiResponse = await this.postToPokeyQuestAPI(data);
                    if (apiResponse && apiResponse.error_code === 'OK') {
                        token = apiResponse.data.token;
                        tokens[i + 1] = token;
                        this.writeTokens(tokens);
                    } else {
                        this.log(`Login failed: ${apiResponse ? apiResponse.error_code : 'No response data'}`.red);
                        continue;
                    }
                }

                const userDetail = data.user;
                console.log(`\n========== Account ${i + 1} | ${userDetail.first_name} ==========`.blue);

                let syncResponse = await this.postTapSync(token);

                while (syncResponse && syncResponse.error_code === 'OK') {
                    const syncData = syncResponse.data;
                    this.log(`Energy remaining: ${syncData.available_taps.toString().white}`.green);
                    this.log(`Balance: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);

                    if (hoinangcap) {
                        await this.checkAndUpgrade(token, Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance));
                    }

                    if (syncData.available_taps >= 50) {
                        this.log(`Start tapping...`.white);
                        const count = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
                        const tapResponse = await this.postTapTap(token, count);
                
                        if (tapResponse && tapResponse.error_code === 'OK') {
                            const tapData = tapResponse.data;
                            this.log(`Energy after tap: ${tapData.available_taps.toString().white}`.green);
                            this.log(`Balance after tap: ${Math.floor(tapData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);
                
                            if (tapData.dropped_cards.length > 0) {
                                this.log(`Dropped Cards:`.yellow);
                                tapData.dropped_cards.forEach(card => {
                                    console.log(`    - Name: ${card.name.yellow}, Rare: ${card.rare}, Level: ${card.level}`);
                                });
                            } else {
                                this.log(`No dropped cards.`.yellow);
                            }
                            syncResponse = tapResponse;
                        } else {
                            this.log(`Tap failed: ${tapResponse ? tapResponse.error_code : 'No response data'}`.red);
                            break; 
                        }
                    } else {
                        this.log(`Low energy, switching to another account!`.red);
                        break;
                    }
                }

                if (syncResponse && syncResponse.error_code !== 'OK') {
                    this.log(`Get user data failure: ${syncResponse.error_code}`.red);
                }
            }
            // Wait for 5 minutes before repeating the loop
            await this.Countdown(300);
        }
    }
}

// Entry point
if (require.main === module) {
    const pq = new PokeyQuest();
    pq.main().catch(err => {
        console.error(err.toString().red);
        process.exit(1);
    });
}
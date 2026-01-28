/**
 * Buckshot Roulette - Web Core
 * Implements the main game loop and interaction logic.
 */

const ITEMS = {
    CIGARETTE: { id: 'cig', emoji: '🚬', name: 'Cigarette', desc: 'Heal 1 Life' },
    HANDSAW: { id: 'saw', emoji: '🔪', name: 'Hand Saw', desc: 'Double Damage' },
    GLASS: { id: 'glass', emoji: '🔍', name: 'Magnifier', desc: 'Check Chamber' },
    BEER: { id: 'beer', emoji: '🍺', name: 'Beer', desc: 'Eject Shell' },
    CUFFS: { id: 'cuffs', emoji: '⛓', name: 'Handcuffs', desc: 'Skip Opponent' }
};

class Game {
    constructor() {
        this.state = {
            round: 1,
            turn: 'player', // 'player' or 'dealer'
            dealerHealth: 4,
            playerHealth: 4,
            maxHealth: 4,
            shells: [], // BOOLEAN: true = live, false = blank
            dealerItems: [],
            playerItems: [],
            damage: 1,
            handcuffed: { player: false, dealer: false },
            gameOver: false
        };

        this.els = {
            dealerHealth: document.getElementById('dealer-health'),
            playerHealth: document.getElementById('player-health'),
            dealerItems: document.getElementById('dealer-inventory'),
            playerItems: document.getElementById('player-inventory'),
            log: document.getElementById('message-log'),
            btnShootDealer: document.getElementById('btn-shoot-dealer'),
            btnShootSelf: document.getElementById('btn-shoot-self'),
            ammoLive: document.querySelector('.live-count'),
            ammoBlank: document.querySelector('.blank-count'),
            history: document.getElementById('shells-display')
        };

        this.init();
    }

    init() {
        // Elements
        this.els = {
            ...this.els,
            startScreen: document.getElementById('start-screen'),
            gameContainer: document.getElementById('game-container'),
            nameInput: document.getElementById('player-name-input'),
            btnStart: document.getElementById('btn-start-game')
        };
        
        // Start Screen Logic
        this.els.nameInput.addEventListener('input', (e) => {
            this.els.btnStart.disabled = e.target.value.trim().length < 3;
        });

        this.els.btnStart.addEventListener('click', () => {
            this.submitLogin();
        });

        this.els.nameInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' && !this.els.btnStart.disabled) {
                this.submitLogin();
            }
        });
    }

    submitLogin() {
        const name = this.els.nameInput.value.trim().toUpperCase();
        if(name.length < 3) return;
        
        this.state.playerName = name;
        this.els.startScreen.style.display = 'none';
        this.els.gameContainer.style.display = 'flex';
        
        this.startGameLoop();
    }

    startGameLoop() {
        this.log(`WAIVER SIGNED BY: ${this.state.playerName || 'UNKNOWN'}`);
        setTimeout(() => this.log('...'), 1000);
        setTimeout(() => this.startRound(), 2000);
        this.attachListeners();
        this.render();
    }

    log(msg) {
        this.els.log.textContent = msg;
        console.log(`[GAME] ${msg}`);
    }

    attachListeners() {
        this.els.btnShootDealer.addEventListener('click', () => this.shoot('dealer'));
        this.els.btnShootSelf.addEventListener('click', () => this.shoot('self'));
    }

    startRound() {
        // Load shells
        const live = Math.floor(Math.random() * 3) + 1; // 1-3
        const blank = Math.floor(Math.random() * 3) + 1; // 1-3
        
        let loadout = Array(live).fill(true).concat(Array(blank).fill(false));
        this.state.shells = this.shuffle(loadout); // Shuffle
        
        this.log(`Loaded: ${live} LIVE, ${blank} BLANK`);
        
        // Give Items
        this.giveItems('player');
        this.giveItems('dealer');
        
        this.updateAmmoDisplay(live, blank);
        this.els.history.innerHTML = ''; // Clear history
        this.render(); // Show items immediately
        
        // Wait 2 seconds so the player can see the counts
        setTimeout(() => {
            this.state.turn = Math.random() > 0.5 ? 'player' : 'dealer';
            this.log(`${this.state.turn.toUpperCase()} starts the round.`);
            
            this.render();

            if(this.state.turn === 'dealer') {
                 document.getElementById('turn-indicator').textContent = "Dealer's Turn";
                 setTimeout(() => this.dealerAI(), 2000);
            } else {
                 document.getElementById('turn-indicator').textContent = "Your Turn";
            }
        }, 2000);
    }

    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    giveItems(who) {
        const count = Math.floor(Math.random() * 3) + 1;
        const pool = Object.values(ITEMS);
        for(let i=0; i<count; i++) {
            const item = pool[Math.floor(Math.random() * pool.length)];
            if(who === 'player') this.state.playerItems.push(item);
            else this.state.dealerItems.push(item);
        }
    }
    addToHistory(isLive) {
        const icon = document.createElement('div');
        icon.className = `shell-icon ${isLive ? 'live' : 'blank'}`;
        this.els.history.appendChild(icon);
    }

    shoot(target) {
        if(this.state.gameOver) return;

        const shell = this.state.shells.pop(); // Take from "top"
        const isLive = shell === true;
        
        // Visual Update History
        this.addToHistory(isLive);
        
        if(target === 'self') {
            if(isLive) {
                this.log(`BANG! ${this.state.turn === 'player' ? 'You' : 'Dealer'} shot themselves.`);
            } else {
                this.log(`Click. It was blank.`);
            }
        } else {
            if(isLive) {
                this.log(`BANG! ${target === 'dealer' ? 'Dealer' : 'You'} hit.`);
            } else {
                this.log(`Click. Blank round.`);
            }
        }

        this.render();
        
        // Wait 2 seconds for the message to be read
        setTimeout(() => {
            this.resolveShot(target, isLive);
        }, 2000);
    }

    resolveShot(target, isLive) {
         if(target === 'self') {
            if(isLive) {
                if (this.state.turn === 'player') this.state.playerHealth -= this.state.damage;
                else this.state.dealerHealth -= this.state.damage;
                
                this.state.damage = 1; // Reset damage
                this.checkWinCondition();
                if(!this.state.gameOver) this.endTurn();
            } else {
                this.log(`${this.state.turn === 'player' ? 'You' : 'Dealer'} go again.`);
                this.state.damage = 1; 
                
                // DO NOT end turn.
                // If dealer, trigger AI again
                if (this.state.turn === 'dealer') {
                    setTimeout(() => this.dealerAI(), 1500);
                }
            }
        } else {
            // Shooting opponent
            if(isLive) {
                if (target === 'dealer') this.state.dealerHealth -= this.state.damage;
                else this.state.playerHealth -= this.state.damage;
            }
            
            this.state.damage = 1;
            this.checkWinCondition();
            if(!this.state.gameOver) this.endTurn();
        }
        this.render();
    }

    endTurn() {
        this.state.turn = this.state.turn === 'player' ? 'dealer' : 'player';
        this.log(`${this.state.turn.toUpperCase()}'s Turn`);
        
        if(this.state.shells.length === 0) {
            this.log('Chamber empty. Reloading...');
            setTimeout(() => this.startRound(), 2000);
            return;
        }

        if(this.state.turn === 'dealer') {
            setTimeout(() => this.dealerAI(), 1500);
        }
    }
    async dealerAI() {
        if(this.state.gameOver || this.state.turn !== 'dealer') return;

        // Simulate thinking time
        this.log('Dealer is thinking...');
        await new Promise(r => setTimeout(r, 1000));

        const liveCount = this.state.shells.filter(s => s).length;
        const totalCount = this.state.shells.length;
        const liveProb = totalCount > 0 ? liveCount / totalCount : 0;

        // 1. Check for guaranteed lethal (All Live)
        if (liveCount === totalCount && totalCount > 0) {
            await this.dealerUseItem('saw'); // Double Dmg if available
            this.shoot('player');
            return;
        }

        // 2. Check for guaranteed safe (All Blank)
        if (liveCount === 0 && totalCount > 0) {
            // Free turn, shoot self to cycle
             this.shoot('self'); 
             return;
        }

        // 3. Heal if low
        if (this.state.dealerHealth < this.state.maxHealth) {
             if (await this.dealerUseItem('cig')) return; // Loop back if item used
        }

        // 4. Strategic Item Usage based on Probability
        if (liveProb >= 0.5 || (totalCount < 4 && liveCount > 0)) {
             // Aggressive items
             if (await this.dealerUseItem('cuffs')) return;
             if (await this.dealerUseItem('glass')) return; 
             if (await this.dealerUseItem('saw')) return;
        }

        // 5. Random Item usage simulation (for unpredictability)
        if (this.state.dealerItems.length > 0 && Math.random() > 0.7) {
            const randomIdx = Math.floor(Math.random() * this.state.dealerItems.length);
            const item = this.state.dealerItems[randomIdx];
            if (await this.dealerUseItem(item.id)) return;
        }

        // 6. Shooting Decision
        // If probability of live is high, shoot player.
        // If it's a toss up or low, maybe risk shooting self for a free turn?
        // Python logic: if live prob >= 0.5 -> Shoot Player. Else -> Shoot Self?
        // Actually Python logic is a bit more complex, but let's stick to a robust strategy.
        
        if (liveProb >= 0.5) {
             this.shoot('player');
        } else {
             // Risk taking: shoot self if odds are good (more blanks)
             this.shoot('self');
        }
    }

    async dealerUseItem(itemId) {
        const idx = this.state.dealerItems.findIndex(i => i.id === itemId);
        if (idx === -1) return false;

        // Specific checks
        if (itemId === 'saw' && this.state.damage > 1) return false; // Don't use if already active
        if (itemId === 'cuffs' && (this.state.handcuffed.player || this.state.handcuffed.dealer)) return false; // Don't use if already cuffed
        if (itemId === 'cig' && this.state.dealerHealth >= this.state.maxHealth) return false;

        const item = this.state.dealerItems[idx];
        this.state.dealerItems.splice(idx, 1);
        this.log(`Dealer used ${item.name}`);
        this.render();
        await new Promise(r => setTimeout(r, 1000));

        // Effect
        switch(itemId) {
            case 'cig':
                this.state.dealerHealth++;
                this.log('Dealer restored 1 Life.');
                break;
            case 'saw':
                this.state.damage = 2;
                this.log('Dealer sawed off the barrel.');
                break;
            case 'glass':
                const nextShell = this.state.shells[this.state.shells.length - 1];
                this.log('Dealer inspected the chamber...');
                await new Promise(r => setTimeout(r, 1000));
                // Dealer acts on knowledge immediately
                if (nextShell) {
                    // It's live! Shoot player!
                    await this.dealerUseItem('saw'); // Try to double damage
                    this.shoot('player');
                    return true; // Turn ends in shoot
                } else {
                    // It's blank! Shoot self (free turn)
                    this.shoot('self');
                    return true; // Turn continues (handled in shoot)
                }
                break; 
            case 'beer':
                const ejected = this.state.shells.pop();
                this.log(`Dealer racked slide. Ejected: ${ejected ? 'LIVE 🔴' : 'BLANK 🔵'}`);
                break;
            case 'cuffs':
                this.state.handcuffed.player = true;
                this.log('You are handcuffed!');
                break;
        }
        
        this.render();
        await new Promise(r => setTimeout(r, 1000));
        
        // Return true only if the item usage ENDED the turn (e.g. shooting inside glass logic).
        // Otherwise return false to let the AI continue its turn loop.
        // Actually, for simplicity, let's have the AI loop call itself again.
        // But preventing infinite loops is good.
        // Let's return true if we want to restart the AI decision loop from the top.
        this.dealerAI(); 
        return true; 
    }

    checkWinCondition() {
        if(this.state.playerHealth <= 0) {
            this.log('YOU DIED. Game Over.');
            this.state.gameOver = true;
            this.showRestart();
        } else if (this.state.dealerHealth <= 0) {
            this.log('YOU WON! The Dealer is defeated.');
            this.state.gameOver = true;
            this.showRestart();
        }
    }

    showRestart() {
        const btn = document.createElement('button');
        btn.textContent = 'PLAY AGAIN';
        btn.onclick = () => window.location.reload();
        btn.className = 'btn btn-blue';
        btn.style.marginTop = '10px';
        this.els.log.appendChild(document.createElement('br'));
        this.els.log.appendChild(btn);
    }

    render() {
        // Health
        this.renderHealth(this.els.dealerHealth, this.state.dealerHealth);
        this.renderHealth(this.els.playerHealth, this.state.playerHealth);

        // Inventory
        this.renderInventory(this.els.playerItems, this.state.playerItems, true);
        this.renderInventory(this.els.dealerItems, this.state.dealerItems, false);

        // Buttons
        const isPlayerTurn = this.state.turn === 'player' && !this.state.gameOver;
        this.els.btnShootDealer.disabled = !isPlayerTurn;
        this.els.btnShootSelf.disabled = !isPlayerTurn;
    }

    renderHealth(container, hp) {
        container.innerHTML = '';
        for(let i=0; i<this.state.maxHealth; i++) {
            const heart = document.createElement('div');
            heart.className = `heart ${i < hp ? '' : 'lost'}`;
            container.appendChild(heart);
        }
    }

    renderInventory(container, items, interactive) {
        container.innerHTML = '';
        items.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = 'item';
            el.textContent = item.emoji;
            if(interactive) {
                el.onclick = () => this.useItem(idx);
            }
            container.appendChild(el);
        });
    }

    useItem(idx) {
        if(this.state.turn !== 'player' || this.state.gameOver) return;
        
        const item = this.state.playerItems[idx];
        this.state.playerItems.splice(idx, 1); // Remove from inventory
        this.log(`Used ${item.name}`);
        
        // Effects
        switch(item.id) {
            case 'cig':
                if(this.state.playerHealth < this.state.maxHealth) {
                    this.state.playerHealth++;
                    this.log('Restored 1 Life.');
                } else {
                    this.log('Health full. Wasted.');
                }
                break;
            case 'saw':
                this.state.damage = 2;
                this.log('Sawed off barrel. Double damage!');
                break;
            case 'glass':
                const nextShell = this.state.shells[this.state.shells.length - 1];
                this.log(`Checked chamber: ${nextShell ? 'LIVE 🔴' : 'BLANK 🔵'}`);
                break;
            case 'beer':
                const ejected = this.state.shells.pop();
                this.log(`Racked slide. Ejected: ${ejected ? 'LIVE 🔴' : 'BLANK 🔵'}`);
                break;
            case 'cuffs':
                if(!this.state.handcuffed.dealer) {
                    this.state.handcuffed.dealer = true;
                    this.log('Dealer handcuffed for next turn.');
                } else {
                    this.log('Already handcuffed.');
                }
                break;
        }
        
        this.render();
    }

    endTurn() {
        // Check if next player is handcuffed
        const nextTurn = this.state.turn === 'player' ? 'dealer' : 'player';
        
        if(this.state.shells.length === 0) {
            this.log('Chamber empty. Reloading...');
            setTimeout(() => this.startRound(), 2500);
            return;
        }

        if(this.state.handcuffed[nextTurn]) {
            this.log(`${nextTurn.toUpperCase()} is handcuffed! Turn skipped.`);
            this.state.handcuffed[nextTurn] = false;
            // Turn stays with current player
             if(this.state.turn === 'dealer') {
                setTimeout(() => this.dealerAI(), 1500);
            }
            return;
        }

        this.state.turn = nextTurn;
        this.log(`${this.state.turn.toUpperCase()}'s Turn`);

        if(this.state.turn === 'dealer') {
            document.getElementById('turn-indicator').textContent = "Dealer's Turn";
            setTimeout(() => this.dealerAI(), 1500);
        } else {
            document.getElementById('turn-indicator').textContent = "Your Turn";
        }
    }

    updateAmmoDisplay(live, blank) {
        this.els.ammoLive.textContent = `🔴 ${live}`;
        this.els.ammoBlank.textContent = `🔵 ${blank}`;
    }
}

// Start Game
window.onload = () => new Game();

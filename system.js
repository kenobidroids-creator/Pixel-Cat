const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let currentLevel = 1;
let grid = [];
let activeOrbiters = [];
let bullets = []; 
let reserveData = [];
let shelfQueue = [null, null, null, null, null]; 
let isSpeedingUp = false;

function generateLevel() {
    grid = []; bullets = []; activeOrbiters = [];
    shelfQueue = [null, null, null, null, null];
    isSpeedingUp = false;
    
    document.getElementById('level-display').innerText = currentLevel;
    updateShelfUI();

    const rows = 22, cols = 18;
    let colorCounts = {};
    
    // Procedural Generation: Pick 2-4 random colors
    const palette = Object.values(CONFIG.colors).sort(() => Math.random() - 0.5);
    const levelColors = palette.slice(0, 2 + Math.floor(Math.random() * 3));
    
    // Create symmetric pattern
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);
    let pattern = [];
    
    for(let r=0; r<halfRows; r++) {
        pattern[r] = [];
        for(let c=0; c<halfCols; c++) {
            pattern[r][c] = {
                active: Math.random() > 0.35,
                color: levelColors[Math.floor(Math.random() * levelColors.length)]
            };
        }
    }

    // Mirror pattern to full grid
    for(let r=0; r<rows; r++) {
        grid[r] = [];
        for(let c=0; c<cols; c++) {
            let pr = r < halfRows ? r : rows - 1 - r;
            let pc = c < halfCols ? c : cols - 1 - c;
            
            // Mask to make it somewhat rounded
            let dist = Math.hypot(c - cols/2, r - rows/2);
            let inBounds = dist < (cols/2 + 2 + Math.random()*2);

            let cellData = pattern[pr][pc];
            grid[r][c] = { 
                color: cellData.color, 
                active: cellData.active && inBounds, 
                targeted: false 
            };
            
            if (grid[r][c].active) {
                colorCounts[cellData.color] = (colorCounts[cellData.color] || 0) + 1;
            }
        }
    }
    
    calculateAmmoForLevel(colorCounts);
    renderReserve();
}

function calculateAmmoForLevel(counts) {
    reserveData = [];
    for (let color in counts) {
        let total = counts[color];
        // Generate many blocks (more as levels progress)
        let packs = Math.min(total, 4 + Math.floor(Math.random() * 4) + Math.floor(currentLevel / 2));
        let amountPerPack = Math.max(1, Math.floor(total / packs));
        
        for (let i = 0; i < packs; i++) {
            let amount = (i === packs - 1) ? total : amountPerPack;
            if (amount > 0) {
                reserveData.push({ color, count: amount, id: Math.random() });
                total -= amount;
            }
        }
    }
    reserveData.sort(() => Math.random() - 0.5); // Shuffle blocks
}

function renderReserve() {
    const reserve = document.getElementById('reserve-ammo');
    reserve.innerHTML = '';
    reserveData.forEach((data) => {
        const div = document.createElement('div');
        div.className = 'ammo-pack';
        div.style.backgroundColor = data.color;
        div.innerText = data.count;
        div.onclick = () => {
            activeOrbiters.push(new OrbitBlock(data.color, data.count));
            div.remove(); 
            // Track removals for Auto-Speed
            reserveData = reserveData.filter(d => d.id !== data.id); 
        };
        reserve.appendChild(div);
    });
}

function handleBlockReturn(orb) {
    let emptyIndex = shelfQueue.findIndex(slot => slot === null);
    if (emptyIndex !== -1) {
        shelfQueue[emptyIndex] = { color: orb.color, count: orb.count };
        updateShelfUI();
    } else {
        alert("GAME OVER! Shelf is full. Try again!");
        generateLevel(); // Restart level
    }
}

function updateShelfUI() {
    for (let i = 0; i < 5; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        slotEl.innerHTML = ''; 
        if (shelfQueue[i]) {
            const pack = document.createElement('div');
            pack.className = 'ammo-pack';
            pack.style.width = '100%'; pack.style.height = '100%';
            pack.style.backgroundColor = shelfQueue[i].color;
            pack.innerText = shelfQueue[i].count;
            pack.onclick = () => {
                activeOrbiters.push(new OrbitBlock(shelfQueue[i].color, shelfQueue[i].count));
                shelfQueue[i] = null; 
                updateShelfUI();
            };
            slotEl.appendChild(pack);
        }
    }
}

function createBullet(sx, sy, target, color) {
    const angle = Math.atan2(target.y - sy, target.x - sx);
    bullets.push({
        x: sx, y: sy, target: target,
        vx: Math.cos(angle) * CONFIG.bulletSpeed, vy: Math.sin(angle) * CONFIG.bulletSpeed, color: color
    });
}

function checkWinSpeed() {
    // If all blocks are deployed, we know the game is ending. Speed it up!
    const shelfEmpty = shelfQueue.every(s => s === null);
    isSpeedingUp = (reserveData.length === 0 && shelfEmpty);
    
    const remaining = grid.flat().filter(c => c.active).length;
    if (remaining === 0 && activeOrbiters.length === 0 && bullets.length === 0) {
        currentLevel++;
        generateLevel();
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    checkWinSpeed();
    
    let speedMult = isSpeedingUp ? 4 : 1;
    
    // Draw U-Shaped Track
    ctx.strokeStyle = "#2f3640"; ctx.lineWidth = 12; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(CONFIG.track.x + CONFIG.track.width, CONFIG.track.y + CONFIG.track.height); // Bottom Right
    ctx.lineTo(CONFIG.track.x + CONFIG.track.width, CONFIG.track.y); // Top Right
    ctx.lineTo(CONFIG.track.x, CONFIG.track.y); // Top Left
    ctx.lineTo(CONFIG.track.x, CONFIG.track.y + CONFIG.track.height); // Bottom Left
    ctx.stroke();

    // Draw Grid
    grid.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell.active) {
                ctx.fillStyle = cell.color;
                ctx.fillRect(CONFIG.gridOffset.x + c*CONFIG.pixelSize, CONFIG.gridOffset.y + r*CONFIG.pixelSize, CONFIG.pixelSize-1, CONFIG.pixelSize-1);
            }
        });
    });

    // Update Orbiters
    activeOrbiters.forEach((orb, i) => {
        orb.update(CONFIG.track, grid, 
            (sx, sy, target, color) => createBullet(sx, sy, target, color),
            (returnedOrb) => handleBlockReturn(returnedOrb),
            speedMult // Pass the multiplier
        );
        
        ctx.fillStyle = orb.color;
        ctx.fillRect(orb.x - 12, orb.y - 12, 24, 24);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 12px Arial";
        ctx.fillText(orb.count, orb.x, orb.y + 4);

        if (orb.isFinished) activeOrbiters.splice(i, 1);
    });

    // Bullet Travel
    bullets.forEach((b, i) => {
        b.x += b.vx * speedMult; 
        b.y += b.vy * speedMult;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
        
        if (Math.hypot(b.target.x - b.x, b.target.y - b.y) < (5 * speedMult)) { // Margin scales with speed
            grid[b.target.r][b.target.c].active = false; 
            bullets.splice(i, 1);
        }
    });

    requestAnimationFrame(gameLoop);
}

window.onload = () => {
    canvas.width = 400; canvas.height = 500;
    generateLevel();
    gameLoop();
};
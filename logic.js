class OrbitBlock {
    constructor(color, count) {
        this.color = color;
        this.count = count;
        this.distance = 0;
        // Total lap is now just the Right, Top, and Left sides
        this.totalLapLength = CONFIG.track.width + (CONFIG.track.height * 2);
        this.isFinished = false;
        this.frameCounter = 0;
    }

    update(track, grid, onFire, onReturn, speedMult) {
        this.distance += (track.speed * speedMult);
        this.frameCounter += speedMult;
        
        this.calculatePosition(track);

        if (this.frameCounter >= CONFIG.fireRate) {
            this.attemptFire(grid, onFire);
            this.frameCounter = 0;
        }

        // ONE LAP RULE: If distance exceeds the U-Shape, attempt to shelf it.
        if (this.distance >= this.totalLapLength) {
            this.isFinished = true; 
            if (this.count > 0) {
                onReturn(this);     
            }
        }
    }

    calculatePosition(t) {
        let d = this.distance;
        if (d < t.height) { 
            // Segment 1: Bottom-Right moving UP
            this.x = t.x + t.width; 
            this.y = t.y + t.height - d; 
        }
        else if (d < t.height + t.width) { 
            // Segment 2: Top-Right moving LEFT
            this.x = t.x + t.width - (d - t.height); 
            this.y = t.y; 
        }
        else if (d < t.height * 2 + t.width) { 
            // Segment 3: Top-Left moving DOWN
            this.x = t.x; 
            this.y = t.y + (d - (t.height + t.width)); 
        }
        else {
            this.isFinished = true; // Reached bottom left
        }
    }

    attemptFire(grid, onFire) {
        if (this.count <= 0) { this.isFinished = true; return; }

        let targetCoords = null;
        let closestDist = Infinity;

        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                let cell = grid[r][c];
                
                if (!cell.active || cell.targeted) continue;

                let px = CONFIG.gridOffset.x + c * CONFIG.pixelSize;
                let py = CONFIG.gridOffset.y + r * CONFIG.pixelSize;

                let alignedX = Math.abs(this.x - px) < 8;
                let alignedY = Math.abs(this.y - py) < 8;

                if ((alignedX || alignedY) && this.hasLineOfSight(grid, r, c, alignedX)) {
                    let d = Math.hypot(this.x - px, this.y - py);
                    if (d < closestDist && cell.color === this.color) {
                        closestDist = d;
                        targetCoords = { x: px, y: py, r, c };
                    }
                }
            }
        }

        if (targetCoords) {
            this.count--;
            grid[targetCoords.r][targetCoords.c].targeted = true; 
            onFire(this.x, this.y, targetCoords, this.color);
        }
    }

    hasLineOfSight(grid, targetR, targetC, isVertical) {
        if (isVertical) {
            let startR = this.y < (CONFIG.gridOffset.y + targetR * CONFIG.pixelSize) ? 0 : grid.length - 1;
            let step = this.y < (CONFIG.gridOffset.y + targetR * CONFIG.pixelSize) ? 1 : -1;
            for (let r = startR; r !== targetR; r += step) {
                if (grid[r] && grid[r][targetC].active) return false; 
            }
        } else {
            let startC = this.x < (CONFIG.gridOffset.x + targetC * CONFIG.pixelSize) ? 0 : grid[0].length - 1;
            let step = this.x < (CONFIG.gridOffset.x + targetC * CONFIG.pixelSize) ? 1 : -1;
            for (let c = startC; c !== targetC; c += step) {
                if (grid[targetR] && grid[targetR][c].active) return false;
            }
        }
        return true;
    }
}
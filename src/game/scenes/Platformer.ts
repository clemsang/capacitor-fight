import { Scene } from 'phaser';

export class Platformer extends Scene {
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    player!: Phaser.Physics.Arcade.Sprite;
    platforms!: Phaser.Physics.Arcade.StaticGroup;
    capacitors!: Phaser.Physics.Arcade.Group;
    score: number = 0;
    scoreText!: Phaser.GameObjects.Text;
    jumpsRemaining: number = 0;
    // level system
    levelIndex: number = 0;
    maxLevels: number = 5;
    levelText!: Phaser.GameObjects.Text;
    boss?: Phaser.Physics.Arcade.Sprite;
    bossHealth: number = 0;
    bossText?: Phaser.GameObjects.Text;
    moneyText!: Phaser.GameObjects.Text;
    bossMinX: number = 600;
    bossMaxX: number = 960;
    keyFive!: Phaser.Input.Keyboard.Key;
    playerCountText!: Phaser.GameObjects.Text;
    lightningSound?: Phaser.Sound.BaseSound;
    bossMusic?: Phaser.Sound.BaseSound;
    keyR!: Phaser.Input.Keyboard.Key;
    debugBodies: boolean = false;
    debugGraphics?: Phaser.GameObjects.Graphics;

    constructor() {
        super('Platformer');
    }

    // Convert white-ish pixels of a loaded image texture into transparent pixels and add as a new canvas texture
    makeWhiteTransparent(srcKey: string, outKey: string) {
        try {
            if (!this.textures.exists(srcKey)) return false;
            if (this.textures.exists(outKey)) return true;

            const srcTex = this.textures.get(srcKey);
            const srcImg = srcTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
            if (!srcImg) return false;

            const w = (srcImg as any).width || 0;
            const h = (srcImg as any).height || 0;
            if (!w || !h) return false;

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;

            ctx.drawImage(srcImg as CanvasImageSource, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                // if nearly white, make transparent
                if (r > 240 && g > 240 && b > 240) {
                    data[i+3] = 0;
                }
            }
            ctx.putImageData(imgData, 0, 0);
            // add canvas as new texture
            this.textures.addCanvas(outKey, canvas);
            return true;
        } catch (e) {
            // ignore errors (e.g., cross-origin); fall back to original texture
            // eslint-disable-next-line no-console
            console.warn('makeWhiteTransparent failed for', srcKey, e);
            return false;
        }
    }

    preload() {
        // We'll generate simple textures at runtime so no external assets are required.
    }

    create() {
        // Generate simple textures: electrician (player), platform, capacitor (collectible), lightning
        const g = this.add.graphics();

        // Electrician: yellow helmet, blue body
        g.clear();
        // body
        g.fillStyle(0x0033aa, 1);
        g.fillRect(0, 8, 28, 40);
        // helmet
        g.fillStyle(0xffdd00, 1);
        g.fillCircle(14, 6, 8);
        g.generateTexture('electrician', 32, 48);
        g.clear();

        // Platform texture: green grass top with soil underneath
        g.clear();
        // grass top
        g.fillStyle(0x2e8b57, 1); // deep green
        g.fillRect(0, 0, 200, 12);
        // grass highlight edge
        g.fillStyle(0x3fbf73, 1);
        g.fillRect(0, 12, 200, 3);
        // soil/dirt body
        g.fillStyle(0x8B5A2B, 1);
        g.fillRect(0, 15, 200, 17);
        // small grass tufts for visual variety
        g.fillStyle(0x2e8b57, 1);
        for (let x = 8; x < 200; x += 28) {
            g.fillTriangle(x, 10, x + 6, 4, x + 12, 10);
        }
        g.generateTexture('platform', 200, 32);
        g.clear();

        // Capacitor: two small plates with a gap (larger texture)
        g.lineStyle(4, 0xffffff, 1);
        g.strokeRect(4, 4, 24, 24);
        // vertical plates
        g.lineStyle(6, 0xddddff, 1);
        g.beginPath();
        g.moveTo(10, 4);
        g.lineTo(10, 28);
        g.moveTo(22, 4);
        g.lineTo(22, 28);
        g.strokePath();
        g.generateTexture('capacitor', 32, 32);
        g.clear();

        // lightning bolt texture (a simple jagged line) - larger
        g.lineStyle(5, 0xffffaa, 1);
        g.beginPath();
        g.moveTo(16, 0);
        g.lineTo(8, 16);
        g.lineTo(20, 16);
        g.lineTo(12, 32);
        g.strokePath();
        g.generateTexture('lightning', 32, 36);
        // don't destroy g here; we'll use helper to create trimmed textures later

        // Background color
        this.cameras.main.setBackgroundColor('#5c94fc');

        // Create static platforms
        this.platforms = this.physics.add.staticGroup();

        // default level will be loaded via loadLevel

        // If optional `electrician_human` asset exists, create a trimmed version (white -> transparent)
        if (this.textures.exists('electrician_human')) {
            this.makeWhiteTransparent('electrician_human', 'electrician_human_trim');
        }

        // Player (electrician) - prefer a real human electrician sprite if provided (trimmed)
        const playerKey = this.textures.exists('electrician_human_trim') ? 'electrician_human_trim' : (this.textures.exists('electrician_human') ? 'electrician_human' : 'electrician');
        this.player = this.physics.add.sprite(100, 600, playerKey);
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);
        // If using a real human sprite we leave scale at 1 by default; otherwise keep generated size
        if (playerKey === 'electrician_human' || playerKey === 'electrician_human_trim') {
            this.player.setScale(1);
        }
        // Recompute body size and offset from the sprite's display dimensions so collisions match visuals
        try {
            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            const pw = Math.max(1, this.player.displayWidth || this.player.width || 32);
            const ph = Math.max(1, this.player.displayHeight || this.player.height || 48);
            // Use a body slightly narrower than the sprite and a bit shorter so feet can overlap platforms
            const bodyW = Math.max(12, Math.round(pw * 0.52));
            const bodyH = Math.max(16, Math.round(ph * 0.82));
            const offsetX = Math.round((pw - bodyW) / 2);
            const offsetY = Math.round(ph - bodyH);
            pBody.setSize(bodyW, bodyH);
            pBody.setOffset(offsetX, offsetY);
        } catch (e) {
            // fallback to safe defaults if body isn't available
            (this.player.body as Phaser.Physics.Arcade.Body).setSize(20, 40).setOffset(6, 4);
        }

        // Per-player floating counter above the electrician
        this.playerCountText = this.add.text(this.player.x, this.player.y - 60, `Capacitors: ${this.score}`, { fontSize: '16px', color: '#ffff88', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
        this.playerCountText.setDepth(30);

        // level/platform/capacitor groups will be created per-level

        this.platforms = this.physics.add.staticGroup();
        this.capacitors = this.physics.add.group();

        // Collide player with platforms
        this.physics.add.collider(this.player, this.platforms);

        // Input
        this.cursors = this.input.keyboard!.createCursorKeys();
        // Cheat key: jump to level 5 when pressing numeric key '5'
        this.keyFive = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);
        // Debug key: toggle collision borders with 'R'
        this.keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // Prepare lightning sound (optional asset). Use a low default volume because sound may be loud.
        try {
            if (this.cache && this.cache.audio && this.cache.audio.exists && this.cache.audio.exists('sfx_lightning')) {
                this.lightningSound = this.sound.add('sfx_lightning', { volume: 0.18 });
            }
        } catch (e) {
            // ignore if audio system or cache not available
        }

        // HUD
        this.scoreText = this.add.text(16, 16, 'Capacitors: 0', { fontSize: '22px', color: '#ffffff' });
        this.levelText = this.add.text(16, 40, 'Level: 1', { fontSize: '18px', color: '#ffffff' });
        // Money counter (top-right). Each capacitor is worth 1000€
        // Use scale width (game canvas width) to position reliably; set high depth so HUD stays on top
        const canvasW = (this.scale && (this.scale.width as number)) ? (this.scale.width as number) : (this.cameras.main && this.cameras.main.width ? this.cameras.main.width : 1024);
        this.moneyText = this.add.text(canvasW - 16, 16, '0€', { fontSize: '22px', color: '#ffff66', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

        // Camera follow
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, 1024, 768);

        // World bounds
        this.physics.world.setBounds(0, 0, 1024, 768);

        // initialize double-jump counter
        this.jumpsRemaining = 2;

        // Start first level
        this.levelIndex = 1;
        this.loadLevel(this.levelIndex);

        // Input
    }

    // level definitions (platforms and capacitor positions). each platform: x,y,w. capacitor positions x,y
    getLevelData() {
        const levels: Array<{ platforms: Array<{x:number,y:number,w:number}>, caps: Array<{x:number,y:number}> }> = [];

        // Level 1
        levels.push({
            platforms: [
                { x: 512, y: 720, w: 1024 },
                { x: 300, y: 560, w: 300 },
                { x: 520, y: 420, w: 300 }
            ],
            caps: [ {x:300,y:520}, {x:520,y:380} ]
        });

        // Level 2
        levels.push({
            platforms: [
                { x: 512, y: 720, w: 1024 },
                { x: 200, y: 600, w: 250 },
                { x: 430, y: 480, w: 240 },
                { x: 700, y: 360, w: 300 }
            ],
            caps: [ {x:200,y:560}, {x:430,y:440}, {x:700,y:320} ]
        });

        // Level 3
        levels.push({
            platforms: [
                { x: 512, y: 720, w: 1024 },
                { x: 150, y: 520, w: 220 },
                { x: 360, y: 420, w: 200 },
                { x: 580, y: 320, w: 200 },
                { x: 820, y: 240, w: 240 }
            ],
            caps: [ {x:150,y:480}, {x:360,y:380}, {x:580,y:260}, {x:820,y:200} ]
        });

        // Level 4
        levels.push({
            platforms: [
                { x: 512, y: 720, w: 1024 },
                { x: 300, y: 560, w: 300 },
                { x: 750, y: 480, w: 300 },
                { x: 200, y: 380, w: 200 },
                { x: 520, y: 300, w: 200 }
            ],
            caps: [ {x:300,y:520}, {x:750,y:440}, {x:200,y:340}, {x:520,y:260} ]
        });

        // Level 5 (boss level) - spread caps and boss entrance
        levels.push({
            platforms: [
                { x: 512, y: 720, w: 1024 },
                { x: 180, y: 560, w: 220 },
                { x: 360, y: 460, w: 220 },
                { x: 540, y: 360, w: 220 },
                { x: 720, y: 260, w: 240 }
            ],
            caps: [ {x:180,y:520}, {x:360,y:420}, {x:540,y:320}, {x:720,y:220}, {x:900,y:180} ]
        });

        return levels;
    }

    loadLevel(n: number) {
        const levels = this.getLevelData();
        if (n < 1 || n > levels.length) return;
        this.levelIndex = n;

        // clear existing platforms & caps & boss
        this.platforms.clear(true, true);
        this.capacitors.clear(true, true);
        if (this.boss) {
            this.boss.destroy();
            this.boss = undefined;
        }
        // stop and destroy boss music if it was playing
        try {
            if (this.bossMusic) {
                this.bossMusic.stop();
                this.bossMusic.destroy();
                this.bossMusic = undefined;
            }
        } catch (e) {
            // ignore audio cleanup errors
        }

        // generate background for level
        this.createBackground(n);

        const level = levels[n-1];
        level.platforms.forEach(p => {
            const plat = this.platforms.create(p.x, p.y, 'platform') as unknown as Phaser.GameObjects.Image;
            plat.setDisplaySize(p.w, 32);
            (plat as any).refreshBody && (plat as any).refreshBody();
        });

        level.caps.forEach(c => {
            const cap = this.capacitors.create(c.x, c.y, 'capacitor') as Phaser.Physics.Arcade.Sprite;
            cap.setBounce(0.2);
            cap.setCollideWorldBounds(false);
            // scale larger for visibility
            if ((cap as any).setDisplaySize) {
                (cap as any).setDisplaySize(28, 28);
            } else {
                cap.setScale(1.5);
            }
        });

        this.physics.add.collider(this.capacitors, this.platforms);
        this.physics.add.overlap(this.player, this.capacitors, this.collectCapacitor as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

        this.score = 0;
        this.scoreText.setText(`Capacitors: ${this.score}`);
        if (this.moneyText) this.moneyText.setText(`${(this.score * 1000).toLocaleString()}€`);
        this.levelText.setText(`Level: ${this.levelIndex}`);

        // If final level, prepare boss after caps collected
        this.bossHealth = 0;
        this.bossText?.destroy();
        this.bossText = undefined;
    }

    createBackground(levelNumber: number) {
        // Prefer a supplied single landscape background if present (bg_landscape), then per-level images (bg_real_1..5).
        const landscapeKey = 'bg_landscape';
        if (this.textures.exists(landscapeKey)) {
            const existing = this.children.getByName('level-bg') as Phaser.GameObjects.Image | undefined;
            if (existing) {
                existing.setTexture(landscapeKey);
            } else {
                const img = this.add.image(512, 384, landscapeKey).setDepth(-10).setName('level-bg');
                img.setScrollFactor(0.5);
                // fit to world bounds if image is smaller/larger
                img.setDisplaySize(1024, 768);
            }
            return;
        }

        // If a realistic background image was supplied in assets for this specific level (bg_real_1..5), use it.
        const realKey = `bg_real_${levelNumber}`;
        if (this.textures.exists(realKey)) {
            const existing = this.children.getByName('level-bg') as Phaser.GameObjects.Image | undefined;
            if (existing) {
                existing.setTexture(realKey);
            } else {
                const img = this.add.image(512, 384, realKey).setDepth(-10).setName('level-bg');
                img.setScrollFactor(0.5);
                img.setDisplaySize(1024, 768);
            }
            return;
        }

        // create a pixel-style landscape with electric accents; generate a texture and set a tiled sprite
        const w = 1024, h = 768;
        const key = `bg_level_${levelNumber}`;
        // remove old if exists
        if (this.textures.exists(key)) this.textures.remove(key);

        const g = this.add.graphics();
        // sky fill
        g.fillStyle(0x112244, 1);
        g.fillRect(0,0,w,h);

        // simple pixel mountains (rect blocks)
        const mountainColors = [0x2b2b55, 0x3b3b66, 0x4b4b77];
        for (let i=0;i<6;i++){
            const mw = 200 + (i*40);
            const mx = (i*180) - 80;
            const my = 520 - (i%3)*30;
            g.fillStyle(mountainColors[i%mountainColors.length],1);
            g.fillRect(mx, my, mw, 200);
        }

        // electricity accents: random bolts across background
        g.lineStyle(2, 0x99ffff, 0.6);
        for (let i=0;i<10;i++){
            const sx = Phaser.Math.Between(50, w-50);
            const sy = Phaser.Math.Between(80, 420);
            const ex = sx + Phaser.Math.Between(-80, 80);
            const ey = sy + Phaser.Math.Between(40, 120);
            g.beginPath();
            g.moveTo(sx, sy);
            g.lineTo((sx+ex)/2, (sy+ey)/2 - 10);
            g.lineTo(ex, ey);
            g.strokePath();
        }

        g.generateTexture(key, w, h);
        const existing = this.children.getByName('level-bg') as Phaser.GameObjects.Image | undefined;
        if (existing) {
            existing.setTexture(key);
        } else {
            const img = this.add.image(512, 384, key).setDepth(-10).setName('level-bg');
            img.setScrollFactor(0.5);
        }
        g.destroy();
    }

    collectCapacitor(_player: any, capObj: Phaser.GameObjects.GameObject) {
        const cap = capObj as Phaser.Physics.Arcade.Sprite;
        cap.disableBody(true, true);

        this.score += 1;
        this.scoreText.setText(`Capacitors: ${this.score}`);
        // update per-player floating counter
        if (this.playerCountText) this.playerCountText.setText(`Capacitors: ${this.score}`);
        // update money counter (1000€ per capacitor)
        try {
            if (this.moneyText) this.moneyText.setText(`${(this.score * 1000).toLocaleString()}€`);
        } catch (e) {
            // ignore formatting errors
            if (this.moneyText) this.moneyText.setText(`${this.score * 1000}€`);
        }

        if (this.capacitors.countActive(true) === 0) {
            // If final level, spawn boss; otherwise advance to next level
            if (this.levelIndex < this.maxLevels) {
                this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'Level Complete!', {
                    fontSize: '48px', color: '#ffffff', stroke: '#000000', strokeThickness: 6
                }).setOrigin(0.5);

                this.time.delayedCall(1200, () => {
                    this.loadLevel(this.levelIndex + 1);
                });
            } else {
                // boss level: spawn boss
                this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'Boss Approaching!', {
                    fontSize: '42px', color: '#ffcc00', stroke: '#000000', strokeThickness: 6
                }).setOrigin(0.5);

                this.time.delayedCall(1000, () => {
                    this.spawnBoss();
                });
            }
        }
    }

    spawnBoss() {
        if (this.boss) return;
        // spawn boss: prefer user-supplied `boss_nurgle` image, process it to remove white background if present
        if (this.textures.exists('boss_nurgle')) {
            this.makeWhiteTransparent('boss_nurgle', 'boss_nurgle_trim');
        }
        const bossKey = this.textures.exists('boss_nurgle_trim') ? 'boss_nurgle_trim' : (this.textures.exists('boss_nurgle') ? 'boss_nurgle' : 'electrician');

        // Determine a sensible spawn point from the current level data (spawn on the last platform)
        const levels = this.getLevelData();
        const level = levels[this.levelIndex - 1] || null;
        let spawnX = 880;
        let spawnY = 200;
        let patrolMin = this.bossMinX;
        let patrolMax = this.bossMaxX;
        if (level && level.platforms && level.platforms.length > 0) {
            const plat = level.platforms[level.platforms.length - 1];
            spawnX = plat.x;
            // Try to find the actual platform GameObject we created for more accurate placement
            const realPlat = this.platforms.getChildren().find((p: any) => Math.abs((p as any).x - plat.x) < 6 && Math.abs((p as any).y - plat.y) < 6) as any | undefined;
            const platDisplayHeight = realPlat && realPlat.displayHeight ? realPlat.displayHeight : 32;
            const platTop = realPlat && realPlat.body ? (realPlat.body as Phaser.Physics.Arcade.Body).top : (plat.y - platDisplayHeight / 2);
            // default patrol bounds derived from platform width if available
            const platDisplayWidth = realPlat && realPlat.displayWidth ? realPlat.displayWidth : (plat.w || 200);
            patrolMin = Math.max((realPlat ? realPlat.x : plat.x) - Math.floor(platDisplayWidth / 2) + 20, 0);
            patrolMax = Math.min((realPlat ? realPlat.x : plat.x) + Math.floor(platDisplayWidth / 2) - 20, 1024);
            // set a provisional spawnY near the platform; we'll snap precisely after creating and sizing the boss
            spawnY = platTop - 10;
        }

        this.boss = this.physics.add.sprite(spawnX, spawnY, bossKey);
        this.boss.setScale(2);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0.2);
        if (!this.textures.exists('boss_nurgle')) {
            // tint placeholder so player can tell it's a boss
            this.boss.setTint(0xff5555);
        }
        // adjust physics body to match visual size (prevent tiny body when scaled)
        const bossBody = this.boss.body as Phaser.Physics.Arcade.Body;
        // compute body size from display dims so it fits the sprite better (centered and slightly inset)
        try {
            const bw = Math.max(40, Math.round(this.boss.displayWidth * 0.6));
            const bh = Math.max(48, Math.round(this.boss.displayHeight * 0.78));
            const offX = Math.round((this.boss.displayWidth - bw) / 2);
            const offY = Math.round((this.boss.displayHeight - bh) / 2);
            bossBody.setSize(bw, bh);
            bossBody.setOffset(offX, offY);
        } catch (e) {
            // fallback to previous heuristic
            bossBody.setSize(Math.max(40, Math.round(this.boss.displayWidth * 0.7)), Math.max(48, Math.round(this.boss.displayHeight * 0.7)));
            bossBody.setOffset(Math.round((this.boss.displayWidth - bossBody.width) / 2), Math.round((this.boss.displayHeight - bossBody.height) / 2));
        }
        // After sizing the boss, snap its visual Y so its bottom sits on the platform top
        try {
            // find the platform game object again for an accurate top position
            const level = this.getLevelData()[this.levelIndex - 1];
            if (level && level.platforms && level.platforms.length > 0) {
                const plat = level.platforms[level.platforms.length - 1];
                const realPlat = this.platforms.getChildren().find((p: any) => Math.abs((p as any).x - plat.x) < 6 && Math.abs((p as any).y - plat.y) < 6) as any | undefined;
                const platTop = realPlat && realPlat.body ? (realPlat.body as Phaser.Physics.Arcade.Body).top : (plat.y - (realPlat && realPlat.displayHeight ? realPlat.displayHeight : 32) / 2);
                // compute sprite Y so the boss body's bottom sits near the platform top
                const bossBodyHeight = bossBody ? bossBody.height : Math.round(this.boss.displayHeight * 0.7);
                const offsetY = (bossBody as any).offset ? (bossBody as any).offset.y : 0;
                const desiredY = platTop - bossBodyHeight - 2 + offsetY;
                this.boss.setY(desiredY + bossBodyHeight * 0.5);
            }
        } catch (e) {
            // ignore snapping errors
        }
        // start with a gentler speed so boss is easier to dodge
        this.boss.setVelocityX(-50);
        // set patrol bounds to platform area so boss stays on its platform
        this.bossMinX = patrolMin;
        this.bossMaxX = patrolMax;
        // reduce boss HP to make the fight easier
        this.bossHealth = 3;

        // play optional boss music (looped) at a controlled volume
        try {
            if (this.cache && this.cache.audio && this.cache.audio.exists && this.cache.audio.exists('bgm_boss')) {
                // play boss music at maximum volume as requested
                this.bossMusic = this.sound.add('bgm_boss', { volume: 1.0, loop: true });
                this.bossMusic.play();
            }
        } catch (e) {
            // ignore audio errors
        }

        // add boss collider with platforms
        this.physics.add.collider(this.boss, this.platforms);

        // overlap: player vs boss
        this.physics.add.overlap(this.player, this.boss, this.onPlayerHitsBoss as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

        // show boss health
        this.bossText = this.add.text(800, 16, `Boss HP: ${this.bossHealth}`, { fontSize: '18px', color: '#ff9999' }).setScrollFactor(0);
    }

    onPlayerHitsBoss(playerObj: Phaser.GameObjects.GameObject, bossObj: Phaser.GameObjects.GameObject) {
        const player = playerObj as Phaser.Physics.Arcade.Sprite;
        const boss = bossObj as Phaser.Physics.Arcade.Sprite;
        // If player is falling onto the boss (stomp), damage boss; otherwise player is hurt and restart level
        const playerBody = player.body as Phaser.Physics.Arcade.Body;
        const bossBody = boss.body as Phaser.Physics.Arcade.Body;

        // Use both downward velocity and relative positions to decide if it's a stomp
        // make stomps easier by lowering required fall speed threshold
        const isFallingFast = playerBody.velocity.y > 80; // lower threshold so stomps register more often
        const playerBottom = playerBody.bottom;
        const bossTop = bossBody.top;

        if (isFallingFast && playerBottom <= bossTop + 12) {
            // stomp
            this.bossHealth -= 1;
            player.setVelocityY(-320);
            // small visual feedback
            boss.setTintFill(0xffaaaa);
            this.time.delayedCall(120, () => {
                boss.clearTint();
            });

            this.bossText && this.bossText.setText(`Boss HP: ${this.bossHealth}`);
            if (this.bossHealth <= 0) {
                boss.disableBody(true, true);
                this.bossText?.destroy();
                // stop boss music if playing
                try {
                    if (this.bossMusic) {
                        this.bossMusic.stop();
                        this.bossMusic.destroy();
                        this.bossMusic = undefined;
                    }
                } catch (e) {
                    // ignore audio errors
                }

                this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'Boss Defeated!', {
                    fontSize: '48px', color: '#ffffff', stroke: '#000000', strokeThickness: 6
                }).setOrigin(0.5);

                this.time.delayedCall(1500, () => {
                    this.scene.start('MainMenu');
                });
            }
        } else {
            // player touched boss from side — apply knockback and brief feedback instead of restarting level
            this.cameras.main.shake(120, 0.005);
            // flash player
            player.setTintFill(0xff9999);
            this.time.delayedCall(150, () => player.clearTint());
            try {
                // push player away from boss and upwards slightly
                const pushX = player.x < boss.x ? -160 : 160;
                player.setVelocity(pushX, -200);
            } catch (e) {
                // fallback: small upward bounce
                player.setVelocityY(-160);
            }
            // small penalty: lose one collected capacitor (if any) to reduce punishment
            if (this.score > 0) {
                this.score = Math.max(0, this.score - 1);
                this.scoreText.setText(`Capacitors: ${this.score}`);
                if (this.playerCountText) this.playerCountText.setText(`Capacitors: ${this.score}`);
                // update money display as well
                try {
                    if (this.moneyText) this.moneyText.setText(`${(this.score * 1000).toLocaleString()}€`);
                } catch (e) {
                    if (this.moneyText) this.moneyText.setText(`${this.score * 1000}€`);
                }
            }
        }
    }

    update() {
        if (!this.cursors || !this.player) return;

        const speed = 220;

        if (this.cursors.left?.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right?.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        // Jumping with double-jump support using Space
        const onGround = (this.player.body as Phaser.Physics.Arcade.Body).blocked.down || (this.player.body as Phaser.Physics.Arcade.Body).touching.down;

        if (onGround) {
            // reset available jumps when touching ground
            this.jumpsRemaining = 2;
        }

        // Space: supports double-jump (consumes one jump each press)
        if (this.cursors.space && Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            if (this.jumpsRemaining > 0) {
                this.player.setVelocityY(-520);
                this.spawnLightning();
                this.jumpsRemaining -= 1;
            }
        }

        // Up arrow: only allow when on ground for a standard jump
        if (this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround) {
            this.player.setVelocityY(-520);
            this.spawnLightning();
            // using up from ground consumes one jump
            this.jumpsRemaining = Math.max(0, this.jumpsRemaining - 1);
        }

        // Simple fall-out check
        if (this.player.y > 900) {
            this.scene.restart();
        }

        // Boss patrol (simple)
        if (this.boss) {
            // slower patrol speed for easier dodging
            if (this.boss.x < this.bossMinX) {
                this.boss.setVelocityX(50);
            } else if (this.boss.x > this.bossMaxX) {
                this.boss.setVelocityX(-50);
            }
            // ensure bossText follows camera
            if (this.bossText) this.bossText.setText(`Boss HP: ${this.bossHealth}`);
        }

        // Cheat: press numeric 5 to jump to level 5
        if (this.keyFive && Phaser.Input.Keyboard.JustDown(this.keyFive)) {
            this.loadLevel(5);
            // reset player position & velocity at start of level
            this.player.setPosition(100, 600);
            this.player.setVelocity(0, 0);
        }

        // update player floating counter position to follow the electrician
        if (this.playerCountText && this.player) {
            this.playerCountText.setPosition(this.player.x, this.player.y - 60);
        }

        // Toggle debug collision borders
        if (this.keyR && Phaser.Input.Keyboard.JustDown(this.keyR)) {
            this.debugBodies = !this.debugBodies;
            if (!this.debugBodies) {
                this.debugGraphics?.clear();
                this.debugGraphics?.destroy();
                this.debugGraphics = undefined;
            } else {
                this.debugGraphics = this.add.graphics().setDepth(10000);
            }
        }

        if (this.debugBodies && this.debugGraphics) {
            this.drawDebugBodies();
        }
    }

    drawDebugBodies() {
        if (!this.debugGraphics) return;
        this.debugGraphics.clear();
        this.debugGraphics.lineStyle(2, 0xff0000, 1);
        try {
            const bodies = (this.physics.world as any).bodies ? (this.physics.world as any).bodies.entries : (this.physics.world as any).bodies;
            const entries = Array.isArray(bodies) ? bodies : bodies || [];
            for (const b of entries) {
                const body = b as Phaser.Physics.Arcade.Body;
                if (!body || !body.gameObject) continue;
                // draw rectangle for the body in world coordinates
                const x = body.x;
                const y = body.y;
                const w = body.width;
                const h = body.height;
                this.debugGraphics.strokeRect(x, y, w, h);
            }
        } catch (e) {
            // ignore debug drawing errors
        }
    }

    spawnLightning() {
        // brief lightning effect above the player
        const lx = this.player.x;
        const ly = this.player.y - 28;
        const l = this.add.sprite(lx, ly, 'lightning').setDepth(20).setScrollFactor(0);
        l.setAlpha(0.98);
        l.setScale(2.0);
        // play optional lightning sound at a low volume — use .play on the prepared sound if available
        try {
            if (this.lightningSound && this.lightningSound.play) {
                this.lightningSound.play();
            } else if (this.sound && this.cache && this.cache.audio && this.cache.audio.exists && this.cache.audio.exists('sfx_lightning')) {
                // fallback: play directly via sound manager with safe low volume
                this.sound.play('sfx_lightning', { volume: 0.18 });
            }
        } catch (e) {
            // ignore audio playback errors (cross-origin or missing codec)
        }
        this.tweens.add({
            targets: l,
            alpha: { from: 0.95, to: 0 },
            duration: 250,
            ease: 'Expo.easeOut',
            onComplete: () => l.destroy()
        });
    }
}

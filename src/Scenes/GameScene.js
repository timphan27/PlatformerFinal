    class GameScene extends Phaser.Scene {

        constructor() {
            super('gameScene');
        }

        init(data) {

            //store current level + next level
            this.levelKey = data.levelKey || "level1";
            this.nextLevel = data.nextLevel || null;

            //movement settings for player
            this.MAX_SPEED = 10;
            this.ACCELERATION = 125;
            this.DECELERATION = 500;

            // JUMP (feel-based values)
            this.GRAVITY = 500;
            this.JUMP_VELOCITY = -350; //velocity of jump
            this.JUMP_HOLD_FORCE = -20;

            this.physics.world.gravity.y = this.GRAVITY;

            // collectibles
            this.collected = 0;
            this.totalCollectibles = 0;

            //double jump variables
            this.jumpsRemaining = 2;

            //starting health
            this.health = 3;

            //player states
            this.isClimbing = false;
            this.isInvincible = false;
            this.isCrouching = false;
        }

        preload() {

            //load tilemap images
            this.load.image(
                "tiles",
                "assets/kenney_pixel-platformer/Tilemap/tilemap_packed.png"
            );

            this.load.spritesheet(
                "tilesSprite",
                "assets/kenney_pixel-platformer/Tilemap/tilemap_packed.png",
                { frameWidth: 18, frameHeight: 18 }
            );

            this.load.image(
                "tilesBackground",
                "assets/kenney_pixel-platformer/Tilemap/tilemap-backgrounds_packed.png"
            );

            this.load.spritesheet(
                "tilesEnemies",
                "assets/kenney_pixel-platformer/Tilemap/tilemap-characters_packed.png",
                { frameWidth: 24, frameHeight: 24 }
            );

            //load all three levels
            this.load.tilemapTiledJSON("level1", "assets/level1.tmj");
            this.load.tilemapTiledJSON("level2", "assets/level2.tmj");
            this.load.tilemapTiledJSON("level3", "assets/level3.tmj");





            //load player sprite
            this.load.image(
                "player",
                "assets/kenney_pixel-platformer/Tiles/Characters/tile_0000.png"
            );

            //load particle effects
            this.load.image(
                "particleLand",
                "assets/kenney_particle-pack/PNG (Transparent)/smoke_01.png"
            );

            this.load.image(
                "particleWalk",
                "assets/kenney_particle-pack/PNG (Transparent)/Rotated/trace_02_rotated.png"
            );

            //load bubble particle images (frame 1 = normal, frame 2 = pop)
            this.load.image(
                "bubbleFrame1",
                "assets/kenney_particle-pack/PNG (Transparent)/circle_01.png"
            );

            this.load.image(
                "bubbleFrame2",
                "assets/kenney_particle-pack/PNG (Transparent)/circle_03.png"
            );

            //load audio
            this.load.audio(
                "collect",
                "assets/kenney_impact-sounds/Audio/footstep_grass_000.ogg"
            );

            this.load.audio(
                "jump",
                "assets/8_BIT_[50_SFX]_Jump_Free_Sound_Effects_N1_BY_jalastram/8_BIT_[50_SFX]_Jump_Free_Sound_Effects_N1_BY_jalastram/SFX_Jump_50.wav"
            );

            this.load.audio(
                "enemyHit",
                "assets/8_BIT_[50_SFX]_Jump_Free_Sound_Effects_N1_BY_jalastram/8_BIT_[50_SFX]_Jump_Free_Sound_Effects_N1_BY_jalastram/SFX_Jump_49.wav"
            )
        }

        create() {

            //fade in from black on scene start
            this.cameras.main.fadeIn(500, 0, 0, 0);

            //build scene in sections
            this.createMap();
            this.createPlayer();
            this.createInput();
            this.createCollisions();
            this.createCamera();
            this.createUI();
            this.createParticles();
            this.createBubbles();

        }

        createMap() {


            //create level from tilemap
            this.map = this.make.tilemap({
                key: this.levelKey
            });

            //add tilesets
            this.tileset = this.map.addTilesetImage(
                'tilemap_packed',
                'tiles'
            );

            this.tilesetBackground = this.map.addTilesetImage(
                'tilemap-backgrounds_packed',
                'tilesBackground'
            );

            //create layers
            this.backgroundLayer = this.map.createLayer(
                'background',
                this.tilesetBackground,
                0,
                0
            );

            this.platformsLayer = this.map.createLayer(
                'platforms',
                this.tileset,
                0,
                0
            );

            this.collectiblesLayer = this.map.createLayer(
                'collectibles',
                this.tileset,
                0,
                0
            );

            this.spikesLayer = this.map.createLayer(
                'spikes',
                this.tileset,
                0,
                0
            );

            this.flagLayer = this.map.createLayer(
                'flag',
                this.tileset,
                0,
                0
            );

            this.movingLayer = this.map.createLayer(
                "movingPlatforms",
                this.tileset,
                0,
                0
            );

            //enable collision for platforms
            this.platformsLayer.setCollisionByProperty({
                collides: true
            });

            //enable collision for spikes
            this.spikesLayer.setCollisionByProperty({
                collides: true
            });

            //count collectibles automatically
            this.collectiblesLayer.forEachTile((tile) => {

                if (tile.properties.collectible === true) {
                    this.totalCollectibles++;
                }

            });

            this.createMovingPlatformsFromTiles();

            //find water tiles in spikes layer and store their world positions
            this.waterTilePositions = [];
            if (this.spikesLayer) {
                this.spikesLayer.forEachTile((tile) => {
                    if (tile.properties && tile.properties.bubbles === true) {
                        this.waterTilePositions.push({
                            x: tile.getCenterX(),
                            y: tile.getCenterY()
                        });
                    }
                });
            }


            //create enemies from object layer called "enemies" in Tiled
            const enemyObjects = this.map.getObjectLayer("enemies").objects;

            this.enemies = this.physics.add.group();

            enemyObjects.forEach(obj => {//allow for manual frame selection via Tiled property, otherwise determine frame based on gid and tileset

                const props = obj.properties || [];
                const manualFrame = props.find(p => p.name === "frame");

                let frameIndex = 0;
                if (manualFrame !== undefined) {
                    frameIndex = manualFrame.value;
                } else if (obj.gid) {
                    const charactersTileset = this.map.tilesets.find(
                        ts => ts.name === "tilemap-characters_packed"
                    );
                    if (charactersTileset && obj.gid >= charactersTileset.firstgid) {
                        frameIndex = obj.gid - charactersTileset.firstgid;
                    }
                }

                const enemy = this.physics.add.sprite(obj.x, obj.y, "tilesEnemies", frameIndex);

                enemy.setCollideWorldBounds(true);

                enemy.spike = props.find(p => p.name === "spike")?.value ?? false; //check if enemy should be a spike (damages player on contact) based on Tiled property

                enemy.direction = -1;
                enemy.speed = 50;
                enemy._platformOffset = 0;
                enemy._onMovingPlatform = false;
                enemy._platform = null;

                this.enemies.add(enemy);
            });

            this.movingPlatforms.children.iterate(platform => {
                if (!platform) return;
                const platTop = platform.y - platform.height / 2;
                const platLeft = platform.x - platform.width / 2;
                const platRight = platform.x + platform.width / 2;

                this.enemies.children.iterate(enemy => {
                    if (!enemy) return;
                    const enemyLeft = enemy.x - enemy.width / 2;
                    const enemyRight = enemy.x + enemy.width / 2;
                    const enemyBottom = enemy.y + enemy.height / 2;
                    const horizontalOverlap = enemyRight > platLeft && enemyLeft < platRight;
                    const verticalOverlap = enemyBottom > platTop && enemy.y - enemy.height / 2 < platform.y + platform.height / 2;
                    if (horizontalOverlap && verticalOverlap) {
                        enemy.y = platTop - enemy.height / 2;
                    }
                });
            });
        }

        createPlayer() {

            //create player
            this.player = this.physics.add.sprite(
                50,
                200,
                "player"
            );

            //movement settings
            this.player.setMaxVelocity(
                this.MAX_SPEED * 60
            );

            this.player.setDragX(
                this.DECELERATION * 60
            );

            // store original size for crouch reset
            this.player.originalWidth = this.player.width;
            this.player.originalHeight = this.player.height;
        }

        createInput() {

            //arrow keys
            this.cursors = this.input.keyboard.createCursorKeys();

            //WASD keys
            this.keys = this.input.keyboard.addKeys({
                left: Phaser.Input.Keyboard.KeyCodes.A,
                right: Phaser.Input.Keyboard.KeyCodes.D,
                up: Phaser.Input.Keyboard.KeyCodes.W,
                down: Phaser.Input.Keyboard.KeyCodes.S,
                jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
                crouch: Phaser.Input.Keyboard.KeyCodes.C
            });

            //level select keys for testing (1, 2, 3)
            this.levelSelectKeys = this.input.keyboard.addKeys({
                level1: Phaser.Input.Keyboard.KeyCodes.ONE,
                level2: Phaser.Input.Keyboard.KeyCodes.TWO,
                level3: Phaser.Input.Keyboard.KeyCodes.THREE
            });
        }

        createCollisions() {

            //player collision with platforms
            this.physics.add.collider(
                this.player,
                this.platformsLayer
            );

            //player collision with spikes
            this.physics.add.collider(
                this.player,
                this.spikesLayer,
                this.takeDamage,
                (player, tile) => tile.properties.damage === true,
                this
            );


            //check for collectible overlap
            this.physics.add.overlap(
                this.player,
                this.collectiblesLayer,
                this.collectItem,
                (player, tile) => tile.properties.collectible === true,
                this
            );

            //check for level end overlap
            this.physics.add.overlap(
                this.player,
                this.flagLayer,
                this.finishLevel,
                (player, tile) => tile.properties.end === true,
                this
            );

            //player collision with moving platforms
            if (this.movingPlatforms) {
                this.physics.add.collider(
                    this.player,
                    this.movingPlatforms
                );
            }

            //enemies collision with platforms for ledge detection
            this.physics.add.collider(
                this.enemies,
                this.platformsLayer
            );

            this.physics.add.collider( //enemies should also collide with moving platforms so they can walk on them
                this.enemies,
                this.movingPlatforms
            );

            //player overlap with enemies (overlap + manual separation avoids physics pushing bodies through platforms)
            this.physics.add.overlap(
                this.player,
                this.enemies,
                this.handlePlayerEnemyCollision,
                null,
                this
            );
        }

        createCamera() {

            //camera bounds
            this.cameras.main.setBounds(
                0,
                0,
                this.map.widthInPixels,
                this.map.heightInPixels
            );

            //camera follow player
            this.cameras.main.startFollow(
                this.player,
                true,
                0.25,
                0.25
            );

            this.cameras.main.setDeadzone(50, 50);

            this.cameras.main.setZoom(1.5);
        }

        createUI() {

            //collectible counter
            this.collectText = this.add.text(
                this.scale.width - 240,
                80,
                "Collectibles: 0 / " + this.totalCollectibles,
                {
                    fontSize: "24px",
                    fill: "#000000"
                }
            )
                .setOrigin(1, 0)
                .setScrollFactor(0);

            //health counter
            this.healthText = this.add.text(
                this.scale.width - 240,
                100,
                "Health: " + this.health,
                {
                    fontSize: "24px",
                    fill: "#000000"
                }
            )
                .setOrigin(1, 0)
                .setScrollFactor(0);
        }

        createParticles() {

            //particle emitter for walking
            this.walkParticles = this.add.particles(
                0,
                0,
                "particleWalk",
                {
                    speed: { min: 10, max: 40 },
                    scale: { start: 0.15, end: 0 },
                    lifespan: 300,
                    quantity: 1,
                    frequency: 50,
                    alpha: { start: 0.6, end: 0 },

                    emitting: false
                }
            );

            //particle emitter for landing
            this.landParticles = this.add.particles(
                0,
                0,
                "particleLand",
                {
                    speed: { min: 10, max: 40 },
                    scale: { start: 0.08, end: 0 },
                    lifespan: 300,
                    quantity: 2,
                    frequency: -1,
                    alpha: { start: 0.25, end: 0 },

                    emitting: false
                }
            );
        }

        createBubbles() { //spawn rising bubbles from water tiles in spikes layer

            if (!this.waterTilePositions || this.waterTilePositions.length === 0) return;

            this.bubbles = this.add.group();
            this.bubbleTimers = [];

            this.waterTilePositions.forEach(pos => {
                const timer = this.time.addEvent({
                    delay: 2000,
                    loop: true,
                    callback: () => {
                        this.spawnBubble(pos.x, pos.y);
                    }
                });
                this.bubbleTimers.push(timer);
            });
        }

        spawnBubble(x, y) {

            const bubble = this.add.sprite(x, y, "bubbleFrame1");
            bubble.setScale(0.08);
            bubble.setAlpha(0.7);
            bubble.setDepth(10);

            const riseDistance = Phaser.Math.Between(30, 70);
            const riseDuration = Phaser.Math.Between(1500, 3000);
            const wobbleX = Phaser.Math.Between(-3, 3);

            this.tweens.add({ //tween to make bubble rise and wobble
                targets: bubble,
                y: y - riseDistance,
                x: x + wobbleX,
                duration: riseDuration,
                ease: "Sine.easeInOut",
                onComplete: () => {
                    this.popBubble(bubble);
                }
            });

            this.bubbles.add(bubble);
        }

        popBubble(bubble) {

            bubble.setTexture("bubbleFrame2");

            this.tweens.add({
                targets: bubble,
                scaleX: 0.14,
                scaleY: 0.14,
                alpha: 0,
                duration: 150,
                onComplete: () => {
                    bubble.destroy();
                }
            });
        }

        update() {

            this.handleInvincibility();
            this.handleMovement();
            this.handleJump();
            this.handleClimbing();
            this.checkFallDeath();
            this.handleMovingPlatforms();
            this.handleEnemyMovement();
            this.handleCrouch();
            this.handleLevelSelect();
        }

        handleMovingPlatforms() {

            if (!this.movingPlatforms) return; //   if there are no moving platforms, skip this function

            this.enemies.children.iterate(enemy => {
                if (!enemy || !enemy.active) return;
                enemy._onMovingPlatform = false;
                enemy._platform = null;
            });

            let playerOnPlatform = false;
            let playerPlatform = null;

            this.movingPlatforms.children.iterate(platform => {

                platform.deltaX = platform.x - platform.prevX; //calculate how much platform has moved since last frame, used to move player and enemies along with platform
                platform.deltaY = platform.y - platform.prevY; //same for vertical movement, used for vertical moving platforms

                const playerBottom = this.player.y + this.player.height / 2;
                const platformTop = platform.y - platform.height / 2;
                const onTop = Math.abs(playerBottom - platformTop) < 4
                    && this.player.x > platform.x - platform.width / 2 - this.player.width / 2
                    && this.player.x < platform.x + platform.width / 2 + this.player.width / 2;

                if (onTop && this.player.body.blocked.down) {
                    playerOnPlatform = true;
                    playerPlatform = platform;
                }

                this.enemies.children.iterate(enemy => { //check if each enemy is standing on this platform, if so set flags to move with platform
                    if (!enemy || !enemy.active) return; //check if enemy is valid

                    const enemyBottom = enemy.y + enemy.height / 2;
                    const enemyOnTop = Math.abs(enemyBottom - platformTop) < 4
                        && enemy.x > platform.x - platform.width / 2 - enemy.width / 2
                        && enemy.x < platform.x + platform.width / 2 + enemy.width / 2;

                    if (enemyOnTop && enemy.body.blocked.down) {
                        if (!enemy._onMovingPlatform) {
                            enemy._platformOffset = enemy.x - platform.x;
                        }
                        enemy._onMovingPlatform = true;
                        enemy._platform = platform;
                    }
                });

                platform.prevX = platform.x;
                platform.prevY = platform.y;
            });

            if (playerOnPlatform && playerPlatform) { //if player is on a moving platform, adjust player position based on platform movement
                const firstLanding = !this._wasOnPlatform || this._lastPlatform !== playerPlatform;
                if (firstLanding) {//if player just landed on platform, store offset between player and platform to maintain consistent position on moving platform
                    this._playerPlatformOffset = this.player.x - playerPlatform.x; //store initial offset when player first lands on platform
                }

                const delta = this.game.loop.delta / 1000;
                const platformVelocityX = delta > 0 ? playerPlatform.deltaX / delta : 0;

                if (!this.keys.left.isDown && !this.keys.right.isDown) {
                    this.player.x = playerPlatform.x + this._playerPlatformOffset;
                    this.player.setVelocityX(platformVelocityX);
                    this.player.body.setAccelerationX(0);
                } else {
                    this._playerPlatformOffset = this.player.x - playerPlatform.x;
                }

                this._wasOnPlatform = true;
                this._lastPlatform = playerPlatform;
            } else {
                this._wasOnPlatform = false;
                this._lastPlatform = null;
            }
        }

        handleInvincibility() {

            if (this.isInvincible) {

                //subtract invincibility timer
                this.invincibleTimer -= this.game.loop.delta;

                //flicker effect
                this.player.visible =
                    Math.floor(this.invincibleTimer / 100) % 2;

                //disable invincibility when timer ends
                if (this.invincibleTimer <= 0) {

                    this.isInvincible = false;
                    this.player.visible = true;
                    this.player.clearTint();
                }
            }
        }

        handleMovement() {

            const speedMultiplier = this.isCrouching ? 0.5 : 1;

            //move left
            if (this.keys.left.isDown) {

                //stop instantly when changing direction
                if (this.player.body.velocity.x > 0) {
                    this.player.setVelocityX(0);
                }

                this.player.body.setAccelerationX(
                    -this.ACCELERATION * speedMultiplier
                );

                this.player.resetFlip();

                //move particle emitter position
                this.walkParticles.setPosition(
                    this.player.x + 8,
                    this.player.y
                );

                this.walkParticles.emitting = true;
            }

            //move right
            else if (this.keys.right.isDown) {

                //stop instantly when changing direction
                if (this.player.body.velocity.x < 0) {
                    this.player.setVelocityX(0);
                }

                this.player.body.setAccelerationX(
                    this.ACCELERATION * speedMultiplier
                );

                this.player.setFlip(true, false);

                //move particle emitter position
                this.walkParticles.setPosition(
                    this.player.x - 20,
                    this.player.y
                );

                this.walkParticles.emitting = true;
            }

            else {

                //stop acceleration when idle
                this.player.body.setAccelerationX(0);

                //disable walk particles
                this.walkParticles.emitting = false;
            }
        }

        handleJump() { //jump logic with double jump and variable height

            //check if player is standing on ground
            const onGround = this.player.body.blocked.down;

            //detect landing
            if (onGround && !this.wasOnGround) {

                //reset double jump
                this.jumpsRemaining = 2;

                //landing particles
                this.landParticles.explode(
                    15,
                    this.player.x,
                    this.player.y + 15
                );

                //landing sound
                this.sound.play("collect", {
                    volume: 0.25
                });
            }

            //store previous ground state
            this.wasOnGround = onGround;

            //start jump
            if (
                Phaser.Input.Keyboard.JustDown(this.keys.jump)
                && this.jumpsRemaining > 0
            ) {

                this.player.setVelocityY(
                    this.JUMP_VELOCITY
                );

                this.jumpsRemaining--;

                //jump sound
                this.sound.play("jump", {
                    volume: 0.25
                });
            }

            //cut jump short if key released
            if (
                this.keys.jump.isUp
                && this.player.body.velocity.y < 0
            ) {

                this.player.setVelocityY(
                    this.player.body.velocity.y * 0.75
                );
            }
        }

        handleClimbing() {

            //check current tile player is touching
            const tile = this.platformsLayer.getTileAtWorldXY(
                this.player.x,
                this.player.y
            );

            //check if tile is climbable
            this.isClimbing =
                tile?.properties?.climbable === true;

            if (this.isClimbing) {

                //disable gravity while climbing
                this.player.body.allowGravity = false;

                //stop falling
                this.player.setVelocityY(0);

                //move up
                if (
                    this.keys.up?.isDown
                    || this.keys.jump.isDown
                ) {

                    this.player.setVelocityY(-150); // climb speed
                }

                //move down
                else if (this.keys.down?.isDown) {

                    this.player.setVelocityY(100); // descend speed
                }

                //stay still
                else {

                    this.player.setVelocityY(0);
                }

            } else {

                //restore gravity
                this.player.body.allowGravity = true;
            }
        }

        checkFallDeath() { // check if player has fallen off the map

            //restart level if player falls below map
            if (this.player.y > this.map.heightInPixels + 100) {

                this.scene.restart({
                    levelKey: this.levelKey,
                    nextLevel: this.nextLevel
                });
            }
        }

        collectItem(player, tile) { //collect item when player overlaps collectible tile

            //remove collectible tile
            this.collectiblesLayer.removeTileAt(
                tile.x,
                tile.y
            );

            //increase collectible count
            this.collected++;

            //update UI text
            this.collectText.setText(
                "Collectibles: "
                + this.collected
                + " / "
                + this.totalCollectibles
            );
        }

        finishLevel() { //call when player overlaps end-level tile

            this.physics.pause();

            this.add.text(
                this.scale.width / 2,
                80,
                "LEVEL COMPLETE",
                {
                    fontSize: "40px",
                    fill: "#60e649"
                }
            )
                .setOrigin(0.5, 0)
                .setScrollFactor(0);

            this.time.delayedCall(1000, () => {

                this.cameras.main.fadeOut(500, 0, 0, 0); //fade out camera after delay

                this.cameras.main.once('camerafadeoutcomplete', () => { //when fade out is complete, either restart scene with next level or show game complete text if there are no more levels

                    if (this.nextLevel) {

                        this.scene.restart({
                            levelKey: this.nextLevel,
                            nextLevel: this.getNextLevel(this.nextLevel)
                        });

                    } else {

                        this.add.text(
                            this.scale.width / 2,
                            140,
                            "GAME COMPLETE",
                            {
                                fontSize: "32px",
                                fill: "#ffd700"
                            }
                        )
                            .setOrigin(0.5, 0)
                            .setScrollFactor(0);
                    }
                });
            });
        }

        getNextLevel(currentLevel) {

            //array of levels in order
            const levels = [
                "level1",
                "level2",
                "level3"
            ];

            const currentIndex = //find index of current level in levels array
                levels.indexOf(currentLevel);

            //return next level if it exists
            if (currentIndex < levels.length - 1) {

                return levels[currentIndex + 1]; //return next level in array if current level is not last one
            }

            return null;
        }

        takeDamage(player, tile) {

            //ignore damage while invincible
            if (this.isInvincible) return;

            //subtract health
            this.health--;

            //update health UI
            this.healthText.setText(
                "Health: " + this.health
            );

            //enable invincibility
            this.isInvincible = true;
            this.invincibleTimer = 2000;

            //flash player red
            this.player.setTint(0xff0000);

            //restart level if health reaches 0
            if (this.health <= 0) {

                this.scene.restart({
                    levelKey: this.levelKey,
                    nextLevel: this.nextLevel
                });
            }
        }

        createMovingPlatformsFromTiles() { // create moving platforms based on tiles in the movingPlatforms layer

            this.movingPlatforms = this.physics.add.group({
                allowGravity: false,
                immovable: true
            });

            const layer = this.movingLayer;

            layer.forEachTile(tile => { // iterate through tiles in movingPlatforms layer

                if (tile.index < 1) return;

                const x = tile.getCenterX();
                const y = tile.getCenterY();
                const frameIndex = tile.index - 1; // adjust for 0-based index

                const platform = this.physics.add.sprite( // create platform sprite at tile position
                    x, y, "tilesSprite", frameIndex
                );

                platform.body.allowGravity = false; // platforms should not fall
                platform.setImmovable(true); // prevent platform from being pushed by player
                platform.setFriction(1); // increase friction to prevent sliding

                platform.startX = x;
                platform.startY = y;
                platform.prevX = x;
                platform.prevY = y;

                this.movingPlatforms.add(platform);

                const distance = tile.properties?.distance ?? 100;
                const speed = tile.properties?.speed ?? 50;
                const direction = tile.properties?.direction ?? "horizontal";

                this.tweens.add({ // create tween to move platform back and forth
                    targets: platform,

                    x: direction === "horizontal"  //if horizontal, move in x direction, otherwise stay at original x
                        ? x + distance
                        : x,

                    y: direction === "vertical" //if vertical, move in y direction, otherwise stay at original y
                        ? y + distance
                        : y,

                    duration: (distance / speed) * 1000, //duration based on distance and speed
                    yoyo: true,
                    repeat: -1,
                    ease: "Linear",

                    onUpdate: () => {
                        platform.body.updateFromGameObject();
                    }
                });
            });

            layer.setVisible(false);
        }

        handleCrouch() {

            const crouchInput = this.keys.crouch.isDown;

            if (crouchInput) { //if crouch key is held down, enter crouch state (c)

                if (!this.isCrouching) { //only enter crouch state if not already crouching

                    this.isCrouching = true;  //flag to indicate player is currently crouching

                    this.player.setDisplaySize( //reduce player height for crouch
                        this.player.originalWidth,
                        this.player.originalHeight * 0.6
                    );

                    this.player.body.setSize( //reduce body size to match new crouched height, keeps width the same
                        this.player.originalWidth,
                        this.player.originalHeight * 0.6
                    );

                    this.player.body.offset.y =
                        this.player.originalHeight * 0.4;
                }

            } else { //c may be released

                if (this.isCrouching) { //if flag is already on, try to stand up (c key released)

                    const feetY = this.player.body.bottom;
                    const standHeadY = feetY - this.player.originalHeight + 2;
                    const halfWidth = this.player.body.width / 2 - 2;

                    const tileLeft = this.platformsLayer.getTileAtWorldXY( //check for tiles above player's head before standing up
                        this.player.x - halfWidth, standHeadY
                    );
                    const tileCenter = this.platformsLayer.getTileAtWorldXY( //check tile directly above player's head
                        this.player.x, standHeadY
                    );
                    const tileRight = this.platformsLayer.getTileAtWorldXY( //check tile above player's head on the right side
                        this.player.x + halfWidth, standHeadY
                    );

                    const blockedByTile = (tileLeft?.collides) || (tileCenter?.collides) || (tileRight?.collides); //check if there are any collidable tiles above player's head that would block standing up

            

                    if (blockedByTile) { //if player is blocked by tile or platform, do not allow player to stand up, keep crouching
                        return; //do not reset to original size 
                    }
    
                    this.isCrouching = false; //reset player size to original dimensions when standing up

                    this.player.setDisplaySize(
                        this.player.originalWidth,
                        this.player.originalHeight
                    );

                    this.player.body.setSize(
                        this.player.originalWidth,
                        this.player.originalHeight
                    );

                    this.player.body.offset.y = 0;
                }
            }
        }

        handleEnemyMovement() {

            this.enemies.children.iterate(enemy => { //loop through every enemy in the scene

                if (!enemy || !enemy.active) return; //check if enemy is invalid

                enemy.setVelocityX(enemy.direction * enemy.speed); //direction = -1 (left) or 1 (right)

                
                const dir = enemy.direction;
                const aheadX = enemy.x + dir * (enemy.width / 2 + 2); //x pos in front of enemy's feet, check for ledges
                const probeY = enemy.y + enemy.height / 2 + 4; //point slightly below enemy, used to check if there is ground in front

                //ledge detection -----------
                let groundAhead = false; //assume no ground ahead until we find some

                // tile ground check (ledge detection)
                const tileAheadDown = this.platformsLayer.getTileAtWorldXY(
                    aheadX,
                    probeY
                );

                if (tileAheadDown) { //check if there are tiles ahead
                    groundAhead = true;
                }

                // moving platform check
                this.movingPlatforms.children.iterate(platform => { //
                    if (!platform || groundAhead) return;

                    const left = platform.x - platform.width / 2;
                    const right = platform.x + platform.width / 2;
                    const top = platform.y - platform.height / 2;

                    const onPlatform =
                        aheadX > left &&
                        aheadX < right &&
                        probeY >= top &&
                        probeY <= top + 10;

                    if (onPlatform) {
                        groundAhead = true;
                    }
                });

            

                
                const tileAhead = this.platformsLayer.getTileAtWorldXY(
                    aheadX,
                    enemy.y
                );

                const blockedByWall = !!tileAhead;

                if (blockedByWall || !groundAhead) {
                    enemy.direction *= -1;
                    enemy.setFlip(enemy.direction > 0, false);
                }

                if (enemy._onMovingPlatform && enemy._platform) {
                    enemy.x += enemy._platform.deltaX;
                }
            });
        }

        handleLevelSelect() { //check for level select key presses for testing purposes

            const levels = ["level1", "level2", "level3"];

            for (let i = 0; i < levels.length; i++) {

                if (Phaser.Input.Keyboard.JustDown(this.levelSelectKeys["level" + (i + 1)])) { //check if level select key (1, 2, or 3) was just pressed

                    const targetLevel = levels[i]; //then target level = corresponding level

                    this.cameras.main.fadeOut(300, 0, 0, 0);

                    this.cameras.main.once('camerafadeoutcomplete', () => {

                        this.scene.restart({ 
                            levelKey: targetLevel, //restart scene with target level as new levelKey, and next level based on target level
                            nextLevel: this.getNextLevel(targetLevel) //use getNextLevel function to determine next level based on target level
                        });
                    });

                    break;
                }
            }
        }

        handlePlayerEnemyCollision(player, enemy) {

            if (!enemy.active) return;

            const playerBottom = player.y + player.height / 2;
            const enemyTop = enemy.y - enemy.height / 2;
            const isPlayerOnTop = playerBottom < enemyTop + 10 && player.body.velocity.y >= 0;

            if (enemy.spike === true) {
                if (!this.isInvincible) {
                    this.takeDamage(player, null);
                    const dir = player.x < enemy.x ? -1 : 1;
                    player.setVelocityX(dir * 200);
                    player.setVelocityY(-150);
                }
            } else {
                if (isPlayerOnTop) { //if player is above enemy and falling onto it, destroy enemy instead of damaging player
                    this.sound.play("enemyHit", { //play enemy hit sound
                        volume: 0.25
                    });
                    enemy.setActive(false);
                    enemy.setVisible(false);
                    enemy.body.enable = false;
                    enemy.destroy();
                    player.setVelocityY(-150);
                    return;
                } else if (!this.isInvincible) { //if player is not on top, damage player as normal
                    this.takeDamage(player, null);
                    const dir = player.x < enemy.x ? -1 : 1; //knockback player away from enemy, direction based on which side of the enemy the player is on
                    player.setVelocityX(dir * 200); //knockback speed
                    player.setVelocityY(-150);//knockback upwards
                }
            }

            // Manually separate player from enemy to prevent overlapping,
            // which would break moving-platform tracking for both bodies.
            // Only separate horizontally for side collisions.
            if (!isPlayerOnTop) {
                const dir = player.x < enemy.x ? -1 : 1;
                const minDist = (player.width + enemy.width) / 2;
                player.x = enemy.x + dir * minDist;
            }
        }
    }
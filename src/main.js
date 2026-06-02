"use strict"

let config = {
    parent: 'phaser-game',

    type: Phaser.CANVAS,

    render: {
        pixelArt: true
    },

    width: 1400,
    height: 430,

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1500 },
            debug: true
        }
    },

    scene: [GameScene]
};

const game = new Phaser.Game(config);
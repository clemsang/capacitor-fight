import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        // Prefer a supplied single landscape background image when available
        if (this.textures.exists('bg_landscape')) {
            this.background = this.add.image(512, 384, 'bg_landscape').setDepth(-10).setName('menu-bg');
            this.background.setDisplaySize(1024, 768);
        } else {
            this.background = this.add.image(512, 384, 'background');
        }

        this.logo = this.add.image(512, 300, 'logo');

        this.title = this.add.text(512, 460, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // (Removed: "Start Main Game" — Platformer is the primary playable scene here)

        const platformerText = this.add.text(512, 560, 'Play Platformer', {
            fontFamily: 'Arial', fontSize: 26, color: '#ffff00'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        platformerText.setDepth(10);
        platformerText.on('pointerdown', () => platformerText.setStyle({ color: '#ffcc88' }));
        platformerText.on('pointerup', () => {
            platformerText.setStyle({ color: '#ffff00' });
            this.scene.start('Platformer');
        });
        platformerText.on('pointerover', () => platformerText.setStyle({ color: '#ffffff' }));
        platformerText.on('pointerout', () => platformerText.setStyle({ color: '#ffff00' }));
    }
}

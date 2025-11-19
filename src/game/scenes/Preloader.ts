import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
        // Optional real art assets (place files in `public/assets/`):
        // - electrician_human.png : main character sprite (single frame)
        // - boss_nurgle.png       : final boss artwork
        // - bg_real_1.jpg .. bg_real_5.jpg : realistic background images per level
        // These are optional; missing files will be reported but won't stop the loader.
        const optionalAssets = [
            ['electrician_human', 'electrician_human.png'],
            ['boss_nurgle', 'boss_nurgle.png'],
            ['bg_real_1', 'bg_real_1.jpg'],
            ['bg_real_2', 'bg_real_2.jpg'],
            ['bg_real_3', 'bg_real_3.jpg'],
            ['bg_real_4', 'bg_real_4.jpg'],
            ['bg_real_5', 'bg_real_5.jpg']
        ];

        // Optional single landscape background (use a high-res landscape image placed in public/assets)
        // file name example: `bg_landscape.jpg` or `bg_landscape.png`
        optionalAssets.push(['bg_landscape', 'bg_landscape.jpg']);

        optionalAssets.forEach(([key, file]) => {
            this.load.image(key as string, file as string);
        });

        // optional sound effects
        // Place `sfx_lightning.mp3` or `sfx_lightning.wav` in `public/assets/` to enable jump sound
        this.load.audio('sfx_lightning', ['sfx_lightning.mp3', 'sfx_lightning.wav']);
        // optional boss background music (looping). Place `bgm_boss.mp3` or `bgm_boss.ogg` in `public/assets/`.
        this.load.audio('bgm_boss', ['bgm_boss.mp3', 'bgm_boss.ogg']);

        // Gracefully handle file load errors so missing optional assets don't break loading
        this.load.on('fileerror', (file: any) => {
            // Log missing optional assets — ignore silently otherwise
            // eslint-disable-next-line no-console
            console.warn(`Optional asset failed to load: ${file.key} -> ${file.src}`);
        });
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }
}

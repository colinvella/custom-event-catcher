const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'icons');
const sizes = [16, 32, 48, 64, 128];

async function createGrayscaleIcons() {
  console.log('Creating grayscale icon versions...');
  
  for (const size of sizes) {
    const inputPath = path.join(iconsDir, `icon-${size}.png`);
    const outputPath = path.join(iconsDir, `icon-${size}-gray.png`);
    
    try {
      await sharp(inputPath)
        .grayscale()
        .composite([{
          input: Buffer.from([255, 255, 255, 128]),
          raw: {
            width: 1,
            height: 1,
            channels: 4
          },
          tile: true,
          blend: 'dest-in'
        }])
        .toFile(outputPath);
      
      console.log(`Created ${outputPath}`);
    } catch (error) {
      console.error(`Error processing icon-${size}.png:`, error.message);
    }
  }
  
  console.log('Grayscale icons created successfully!');
}

createGrayscaleIcons().catch(console.error);
